# pragma: exclude file
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from vera_plugins.tools.registry import PluginRegistry

from adapters.identity_provider import IdentityProvider

# from time import sleep

# from sqlalchemy import or_, text, update
# from sqlalchemy.exc import OperationalError
# from sqlalchemy.orm import Session

# from adapters.database import (
#     DatabaseEngine,
#     DatabaseUrl,
#     with_database_session,
# )
# from adapters.indexer import is_indexer_available
# from config import VeraConfig
# from definitions.task import TaskState
# from repositories.models.task import PeriodicTask, TaskModel
# from vera_scheduler import vera_scheduler

logger = logging.getLogger("uvicorn")


# def check_connection():
#     retries = 5
#     for attempt in range(retries):
#         try:
#             with DatabaseEngine.connect():
#                 return True
#         except OperationalError:
#             logger.error(
#                 f"Attempt {attempt + 1}/{retries}: "
#                 f"Failed to connect to the database. Retrying."
#             )
#             sleep(2**attempt)

#     return False


# def check_index_connection(retries: int = 5):
#     for attempt in range(retries):
#         if is_indexer_available():
#             return True
#         else:
#             logger.error(
#                 f"Attempt {attempt + 1}/{retries}: "
#                 f"Failed to connect to the index. Retrying."
#             )
#             sleep(2**attempt)

#     return False


# def get_actual_revision():
#     try:
#         with DatabaseEngine.connect() as connection:
#             result = connection.execute(
#                 text("SELECT version_num FROM alembic_version;")
#             )
#             row = result.fetchone()
#             if row is not None:
#                 return row[0]
#     except Exception:
#         return None


# def ensure_last_database_revision():
#     from alembic.command import upgrade
#     from alembic.config import Config
#     from alembic.script import ScriptDirectory

#     alembic_cfg = Config("alembic.ini")
#     script_dir = ScriptDirectory.from_config(alembic_cfg)
#     alembic_cfg.set_main_option("sqlalchemy.url", DatabaseUrl)

#     heads = script_dir.get_revisions("head")
#     latest_revision = heads[0].revision if heads else None

#     if get_actual_revision() != latest_revision:
#         upgrade(alembic_cfg, "head")

#     logger.info(
#         f"Using database revision {latest_revision}.",
#     )


# @with_database_session
# def set_failed_tasks_on_start(session: Session):
#     logger.info(
#         "Setting all tasks in Planned or Running state to Failed on startup."
#     )
#     session.execute(
#         update(TaskModel)
#         .where(
#             or_(
#                 TaskModel.task_state == TaskState.Planned,
#                 TaskModel.task_state == TaskState.Running,
#             )
#         )
#         .values(task_state=TaskState.Failed, finished=VeraConfig.Timestamp)
#     )
#     session.commit()
#     logger.info("Tasks have been updated to Failed state on startup.")


# @with_database_session
# def setup_periodic_tasks_on_start(session: Session):
#     logger.info("Setting up periodic tasks on startup.")

#     for periodic_task in PeriodicTask.all(session):
#         periodic_task.schedule()

#     logger.info("All periodic tasks have been set up.")


@asynccontextmanager
async def lifespan(app_: FastAPI):
    # logger.info("Checking database connection.")
    # if not check_connection():
    #     logger.info("Database connection failed. Exiting.")
    #     return
    # logger.info("Database connection successfully established.")

    # logger.info("Checking index connection.")
    # if not check_index_connection():
    #     logger.info("Index connection failed. Exiting.")
    #     return
    # logger.info("Index connection successfully established.")

    # ensure_last_database_revision()

    # vera_scheduler.start()

    # set_failed_tasks_on_start()
    # plan_startup_tasks()
    # setup_periodic_tasks_on_start()
    plugin_registry = PluginRegistry()
    app_.state.plugin_registry = plugin_registry
    app_.state.identity_provider = IdentityProvider(plugin_registry)

    yield

    # vera_scheduler.shutdown()
    logger.info("Shutting down.")
