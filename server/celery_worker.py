from celery import Celery
from os import environ, path
from sys import path as sys_path

from services.database import DATABASE_URL, get_db
from tasks.types import TaskState, TaskType
from tasks import api
import crud.tasks as crud


sys_path.append(path.abspath("/app"))


celery_worker = Celery(
    "tasks",
    broker=environ.get("BROKER_URL"),
    result_backend=f"db+{DATABASE_URL}",
    database_table_names={
        "task": "celery_tasks",
        "group": "celery_groups",
    },
)


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

    import models

    sys_path.append(path.abspath("categories/"))
    sys_path.append(path.abspath("extractions/"))

    db = next(get_db())
    task = crud.get_task(task_id, db)
    api.set_task_started(task, db)
    api.update_task_state(task, TaskState.Running, db)
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

        api.set_task_finished(task, db)
        api.update_task_state(task, TaskState.Finished, db)
    except Exception as e:
        print(f"Task with id {task_id} failed: {e}")
        api.set_task_finished(task, db)
        api.update_task_state(task, TaskState.Failed, db)
