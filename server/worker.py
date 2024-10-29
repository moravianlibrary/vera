import logging
from celery import Celery
from os import path
from sys import path as sys_path
from models.base_engine import DatabaseUrl, get_session
from datatypes import TaskState
from config import VeraConfig
from models import Task, PeriodicTask
from tasks import TaskDispatcher, add_documents
import redis
from contextlib import contextmanager


sys_path.append(path.abspath("/app"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Worker")


celery_worker = Celery(
    "tasks",
    broker=VeraConfig.Broker.Url,
    broker_connection_retry_on_startup=True,
    result_backend=f"db+{DatabaseUrl}",
    database_table_names={
        "task": "celery_tasks",
        "group": "celery_groups",
    },
    timezone=VeraConfig.TimeZone,
)
redis_client = redis.Redis(
    host=VeraConfig.Broker.Host, port=VeraConfig.Broker.Port
)


@celery_worker.task
def run_periodic_task_instance(periodic_task_id: int):
    logger.info(f"Running periodic task instance with id {periodic_task_id}.")

    session = next(get_session())
    periodic_task = PeriodicTask.find(session, periodic_task_id)
    if periodic_task is None:
        logger.warn(f"Periodic task with id {periodic_task_id} not found.")
        return

    logger.info(f"Creating new task for periodic task {periodic_task_id}.")
    task = Task(
        task_type=periodic_task.task_type,
        owner=VeraConfig.BotName,
        query_params=periodic_task.query_params,
    ).save(session)

    logger.info(
        f"Task created with id {task.id} for periodic task {periodic_task_id}."
    )
    run_task.delay(task_id=task.id)


@celery_worker.task
def run_task(task_id: int):
    logger.info(f"Running task with id {task_id}.")

    session = next(get_session())
    task = Task.find(session, task_id)

    if not task:
        logger.error(f"Task with id {task_id} not found.")

    task.started = VeraConfig.Timestamp
    task.task_state = TaskState.Running
    task.save(session)

    try:
        task_function = TaskDispatcher.get(task.task_type)
        if task_function is None:
            logger.error(
                f"Task with id {task_id} failed "
                f"due to unknown task type: {task.task_type}"
            )
            return

        logger.info(f"Executing task function for task id {task_id}.")
        task_function(session, task_id)

        task.task_state = TaskState.Finished
        logger.info(f"Task with id {task_id} has finished successfully.")
    except Exception as e:
        task.task_state = TaskState.Failed
        logger.error(f"Task with id {task_id} failed due to error: {e}")
    finally:
        task.finished = VeraConfig.Timestamp
        task.save(session)


@contextmanager
def redis_lock(lock_name):
    """
    Yield 1 if specified lock_name is not already set in redis.
    Otherwise returns 0.
    """
    status = redis_client.set(lock_name, "lock", nx=True)
    try:
        yield status
    finally:
        redis_client.delete(lock_name)


@celery_worker.task
def run_add_documents():
    with redis_lock("my_lock_name") as acquired:
        add_documents()
