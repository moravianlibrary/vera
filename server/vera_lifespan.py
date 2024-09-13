# pragma: no cover
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler


logger = logging.getLogger("uvicorn")


def ensure_today_intention():
    from services.database import get_db
    from models import Intention

    Intention.ensure_intention_for_today(next(get_db()))


@asynccontextmanager
async def lifespan(app_: FastAPI):
    from services.database import (
        check_connection,
        check_database_revision,
        get_db,
    )
    from worker import set_failed_tasks_on_start

    logger.info("Checking database connection.")
    if not check_connection():
        logger.info("Database connection failed. Exiting.")
        return
    logger.info("Database connection successfully established.")
    check_database_revision()

    set_failed_tasks_on_start(next(get_db()))

    scheduler = BackgroundScheduler()
    scheduler.start()

    scheduler.add_job(ensure_today_intention, "cron", hour=0)

    yield

    scheduler.shutdown()
    logger.info("Shutting down.")
