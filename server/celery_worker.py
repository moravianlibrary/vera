from celery import Celery
from os import environ

from services.database import DATABASE_URL, get_db
from tasks.enums import TaskState, TaskType
from tasks import crud
import predictions

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
    from tasks.routines import predict_volumes_pages, sync_from_catalog

    db = next(get_db())
    task = crud.get_task(task_id, db)
    crud.set_task_started(task_id, db)
    crud.update_task_state(task_id, TaskState.Running, db)
    try:
        if task.task_type == TaskType.PredictVolumePages:
            predict_volumes_pages(task_id, db)
        elif task.task_type == TaskType.SyncFromCatalog:
            sync_from_catalog(task_id, task.owner, db)
        crud.set_task_finsihed(task_id, db)
        crud.update_task_state(task_id, TaskState.Finished, db)
    except Exception as e:
        print(f"Task with id {task_id} failed: {e}")
        crud.set_task_finsihed(task_id, db)
        crud.update_task_state(task_id, TaskState.Failed, db)
