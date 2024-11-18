# pragma: exclude file
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from models import (
    DatabaseUrl,
    Engine,
    with_db_session,
    Task,
    PeriodicTask,
    Intention,
    StartupTasks,
)
from datatypes import TaskState, TaskItemType
from time import sleep
from sqlalchemy.orm import Session
from sqlalchemy import update, or_, text
from sqlalchemy.exc import OperationalError
from config import VeraConfig
from worker import run_task
from vera_scheduler import vera_scheduler
from schemas import AddDocumentResponse, EsSession
from services.elasticsearch import with_es_session


logger = logging.getLogger("uvicorn")


def check_connection():
    retries = 5
    for attempt in range(retries):
        try:
            with Engine.connect():
                return True
        except OperationalError:
            logger.error(
                f"Attempt {attempt + 1}/{retries}: "
                f"Failed to connect to the database. Retrying."
            )
            sleep(2**attempt)

    return False


def get_actual_revision():
    try:
        with Engine.connect() as connection:
            result = connection.execute(
                text("SELECT version_num FROM alembic_version;")
            )
            row = result.fetchone()
            if row is not None:
                return row[0]
    except Exception:
        return None


def ensure_last_database_revision():
    from alembic.command import upgrade
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    alembic_cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    alembic_cfg.set_main_option("sqlalchemy.url", DatabaseUrl)

    heads = script_dir.get_revisions("head")
    latest_revision = heads[0].revision if heads else None

    if get_actual_revision() != latest_revision:
        upgrade(alembic_cfg, "head")

    logger.info(
        f"Using database revision {latest_revision}.",
    )


@with_db_session
def set_failed_tasks_on_start(session: Session):
    logger.info(
        "Setting all tasks in Planned or Running state to Failed on startup."
    )
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
    logger.info("Tasks have been updated to Failed state on startup.")


@with_db_session
def setup_periodic_tasks_on_start(session: Session):
    logger.info("Setting up periodic tasks on startup.")

    for periodic_task in PeriodicTask.all(session):
        periodic_task.schedule()

    logger.info("All periodic tasks have been set up.")


@with_db_session
def ensure_today_intention(session: Session):
    Intention.ensure_intention_for_today(session)


@with_es_session
def recreate_add_documents_responses(es_session: EsSession):
    logger.info("Recreating add documents responses index.")
    AddDocumentResponse.recreate_index(es_session)


@with_db_session
def plan_startup_tasks(session: Session):
    for startup_task in StartupTasks.all(session):
        if startup_task.is_one_time_task and startup_task.has_run:
            continue

        logger.info(f"Planning start up task {startup_task.task_type.value}")
        task = Task(
            task_type=startup_task.task_type,
            owner=VeraConfig.BotName,
        ).save(session)

        if startup_task.item_type == TaskItemType.CatalogRecord:
            session.execute(
                text(
                    """
                    INSERT INTO task_items (task_id, item_id, item_type)
                    SELECT :task_id, sysno, 'CatalogRecord'
                    FROM catalog_records
                    """
                ),
                {"task_id": task.id},
            )
        elif startup_task.item_type == TaskItemType.Document:
            session.execute(
                text(
                    """
                    INSERT INTO task_items (task_id, item_id, item_type)
                    SELECT :task_id, CAST(id AS VARCHAR), 'Document'
                    FROM documents
                    """
                ),
                {"task_id": task.id},
            )

        startup_task.has_run = True
        startup_task.save(session)

        run_task.delay(task_id=task.id)


@asynccontextmanager
async def lifespan(app_: FastAPI):
    logger.info("Checking database connection.")
    if not check_connection():
        logger.info("Database connection failed. Exiting.")
        return
    logger.info("Database connection successfully established.")

    ensure_last_database_revision()

    recreate_add_documents_responses()

    vera_scheduler.start()

    set_failed_tasks_on_start()
    plan_startup_tasks()
    setup_periodic_tasks_on_start()
    ensure_today_intention()

    vera_scheduler.add_job(ensure_today_intention, "cron", hour=0)

    yield

    vera_scheduler.shutdown()
    logger.info("Shutting down.")
