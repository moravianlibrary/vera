import logging
from celery import Celery
from celery.schedules import crontab
from os import environ, path
from sys import path as sys_path
from services.database import DATABASE_URL, get_db
from datatypes import TaskState, TaskType
from sqlalchemy.orm import Session
from sqlalchemy import update, or_
from config import VeraConfig
from models import Task, PeriodicTask
from tasks import (
    PredictPeriodicalPageCount,
    Reindex,
    SyncFromCatalogs,
    SyncFromDigitizationRegistry,
)


sys_path.append(path.abspath("/app"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


celery_worker = Celery(
    "tasks",
    broker=environ.get("BROKER_URL"),
    result_backend=f"db+{DATABASE_URL}",
    database_table_names={
        "task": "celery_tasks",
        "group": "celery_groups",
    },
)


def set_failed_tasks_on_start(session: Session):
    session.execute(
        update(Task)
        .where(
            or_(
                Task.task_state == TaskState.Planned,
                Task.task_state == TaskState.Running,
            )
        )
        .values(task_state=TaskState.Failed, finished=VeraConfig.Timestamp)
    )
    session.commit()


def setup_periodic_tasks_on_start(session: Session):
    for periodic_task in PeriodicTask.all():
        setup_periodic_task(session, periodic_task)


TASK_TYPE_TO_TASK_FUNCTION = {
    TaskType.PredictPeriodicalPageCount: PredictPeriodicalPageCount,
    TaskType.Reindex: Reindex,
    TaskType.SyncFromCatalogs: SyncFromCatalogs,
    TaskType.SyncFromDigitizationRegistry: SyncFromDigitizationRegistry,
}


def setup_periodic_task(periodic_task: PeriodicTask):
    celery_worker.add_periodic_task(
        crontab(
            minute=periodic_task.minute_str,
            hour=periodic_task.hour_str,
            day_of_week=periodic_task.day_of_week_str,
            day_of_month=periodic_task.day_of_month_str,
        ),
        run_periodic_task_instance.s(periodic_task.id),
    )


@celery_worker.task
def run_periodic_task_instance(periodic_task_id: int):
    session = next(get_db())
    periodic_task = PeriodicTask.find(session, periodic_task_id)
    if periodic_task is None:
        return

    task = Task(
        task_type=periodic_task.task_type,
        owner=VeraConfig.BotName,
        query=periodic_task.query,
    ).save(session)

    run_task.delay(task_id=task.id)


@celery_worker.task
def run_task(task_id: int):
    # import models
    # sys_path.append(path.abspath("categories/"))
    # sys_path.append(path.abspath("extractions/"))

    session = next(get_db())
    task = Task.get(session, task_id)

    task.started = VeraConfig.Timestamp
    task.task_state = TaskState.Running
    task.save(session)

    try:
        task_function = TASK_TYPE_TO_TASK_FUNCTION.get(task.task_type)
        if task_function is None:
            raise ValueError(f"Unknown task type: {task.task_type}")
        task_function(session, task_id)

        task.finished = VeraConfig.Timestamp
        task.task_state = TaskState.Finished
        task.save(session)
    except Exception as e:
        logging.warning(f"Task with id {task_id} failed: {e}")
        task.finished = VeraConfig.Timestamp
        task.task_state = TaskState.Failed
        task.save(session)
