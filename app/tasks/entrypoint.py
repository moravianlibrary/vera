from celery import shared_task


@shared_task
def init_task(task_id: int) -> None:
    pass


@shared_task
def run_task(task_id: int) -> None:
    pass
