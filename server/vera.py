from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

import routers
from config import VeraConfig


logger = logging.getLogger("uvicorn")


# TODO: fix logging.
# TODO: add support to logger editing of documents
# TODO: add checking unique before insert and update


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


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=(VeraConfig.AllowCorsOrigins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(routers.catalog_records_router)
app.include_router(routers.categories_router)
app.include_router(routers.departments_router)
app.include_router(routers.digitization_lists_router)
app.include_router(routers.documents_router)
app.include_router(routers.extractions_router)
app.include_router(routers.intentions_router)
app.include_router(routers.locations_router)
app.include_router(routers.roles_router)
app.include_router(routers.tasks_router)
app.include_router(routers.users_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="fine",
    )
