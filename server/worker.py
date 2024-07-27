import logging
from celery import Celery
from os import environ, path
from sys import path as sys_path
from services.database import DATABASE_URL, get_db
from datatypes import TaskState, TaskType
from sqlalchemy.orm import Session
from sqlalchemy import update, or_
from config import VeraConfig
from models import Task
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


TASK_TYPE_TO_TASK_FUNCTION = {
    TaskType.PredictPeriodicalPageCount: PredictPeriodicalPageCount,
    TaskType.Reindex: Reindex,
    TaskType.SyncFromCatalogs: SyncFromCatalogs,
    TaskType.SyncFromDigitizationRegistry: SyncFromDigitizationRegistry,
}


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
