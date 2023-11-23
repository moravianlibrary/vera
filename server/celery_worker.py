from celery import Celery

from services.database import DATABASE_URL

celery_worker = Celery(
    "tasks",
    broker="redis://localhost:6379/0",  # Replace with your broker URL (e.g., Redis)
    result_backend=f"db+{DATABASE_URL}"
)
