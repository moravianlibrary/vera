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


def set_failed_tasks_on_start(db: Session):
    db.execute(
        update(Task)
        .where(
            or_(
                Task.task_state == TaskState.Planned,
                Task.task_state == TaskState.Running,
            )
        )
        .values(task_state=TaskState.Failed, finished=VeraConfig.Timestamp)
    )
    db.commit()


@celery_worker.task
def run_task(task_id: int):
    from tasks.tasks.predict_periodicals_pages import predict_periodicals_pages
    from tasks.tasks.sync_from_catalog import sync_from_catalog
    from tasks.tasks.sync_from_digitization_registry import (
        sync_from_digitization_registry,
    )

    from tasks.routines import (
        generate_volumes_pages_dataset,
        generate_items_pages_dataset,
    )

    # import models

    sys_path.append(path.abspath("categories/"))
    sys_path.append(path.abspath("extractions/"))

    db = next(get_db())
    task = Task.get(db, task_id)

    task.started = VeraConfig.Timestamp
    task.task_state = TaskState.Running
    task.save()

    try:
        if task.task_type == TaskType.PredictVolumePages:
            predict_periodicals_pages(task_id, db)
        elif task.task_type == TaskType.SyncFromCatalog:
            sync_from_catalog(task_id, task.owner, db)
        elif task.task_type == TaskType.SyncFromDigitizationRegistry:
            sync_from_digitization_registry(task_id, task.owner, db)
        elif task.task_type == TaskType.GenerateVolumesPagesDataset:
            generate_volumes_pages_dataset(task_id, task.owner, db)
        elif task.task_type == TaskType.GenerateItemsPagesDataset:
            generate_items_pages_dataset(task_id, task.owner, db)

        task.finished = VeraConfig.Timestamp
        task.task_state = TaskState.Finished
        task.save()
    except Exception as e:
        logging.warning(f"Task with id {task_id} failed: {e}")
        task.finished = VeraConfig.Timestamp
        task.task_state = TaskState.Failed
        task.save()
