from celery import Celery

from services.database import DATABASE_URL, get_db
from tasks.routines import predict_items_pages

celery_worker = Celery(
    "tasks",
    broker="redis://localhost:6379/0",
    result_backend=f"db+{DATABASE_URL}",
    database_table_names={
        'task': 'celery_tasks',
        'group': 'celery_groups',
    }
)


@celery_worker.task
def predict_items_pages_task(task_id: int,
                             preserver_pages_count: bool):
    with get_db() as db:
        predict_items_pages.predict(task_id, preserver_pages_count, db)
