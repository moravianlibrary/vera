# pragma: exclude file
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from models import DatabaseUrl, Engine
from time import time


logger = logging.getLogger("uvicorn")


def check_connection():
    from sqlalchemy.exc import OperationalError

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
            time.sleep(2**attempt)

    return False


def get_actual_revision():
    from sqlalchemy import text

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


def ensure_today_intention():
    from models.base_engine import get_session
    from models import Intention

    Intention.ensure_intention_for_today(next(get_session()))


def sync_all_from_catalogs():
    from config import VeraConfig
    from datatypes import TaskType
    from models.base_engine import get_session
    from models import Document, Task, TaskDocument
    from worker import run_task

    session = next(get_session())
    task = Task(
        task_type=TaskType.SyncFromCatalogs,
        owner=VeraConfig.BotName,
    ).save(session)
    for document in Document.all(session):
        TaskDocument(task_id=task.id, document_id=document.id).save(session)

    run_task.delay(task_id=task.id)


def reindex_all():
    from config import VeraConfig
    from datatypes import TaskType
    from models.base_engine import get_session
    from models import Document, Task, TaskDocument
    from worker import run_task

    session = next(get_session())
    task = Task(
        task_type=TaskType.Reindex,
        owner=VeraConfig.BotName,
    ).save(session)
    for document in Document.all(session):
        TaskDocument(task_id=task.id, document_id=document.id).save(session)

    run_task.delay(task_id=task.id)


def recreate_index():
    from config import VeraConfig
    from datatypes import TaskType
    from models.base_engine import get_session
    from models import Document, Task, TaskDocument
    from worker import run_task
    from services.documents_indexer import DocumentsIndexer

    DocumentsIndexer.get_instance().recreate_index()

    session = next(get_session())
    task = Task(
        task_type=TaskType.Reindex,
        owner=VeraConfig.BotName,
    ).save(session)
    for document in Document.all(session):
        TaskDocument(task_id=task.id, document_id=document.id).save(session)

    run_task.delay(task_id=task.id)


@asynccontextmanager
async def lifespan(app_: FastAPI):
    from models.base_engine import get_session
    from worker import set_failed_tasks_on_start

    logger.info("Checking database connection.")
    if not check_connection():
        logger.info("Database connection failed. Exiting.")
        return
    logger.info("Database connection successfully established.")
    ensure_last_database_revision()
    # TODO: check on startup table
    # sync_all_from_catalogs()
    # recreate_index()
    # reindex_all()

    set_failed_tasks_on_start(next(get_session()))

    scheduler = BackgroundScheduler()
    scheduler.start()

    scheduler.add_job(ensure_today_intention, "cron", hour=0)

    yield

    scheduler.shutdown()
    logger.info("Shutting down.")
