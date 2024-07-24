from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from routers import (
    locations_router,
    intentions_router,
    extractions_router,
    documents_router,
    security_router,
    tasks_router,
    digitization_lists_router,
    catalogs_router,
    categories_router,
)
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
    from tasks.api import set_failed_tasks_on_start

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


app.include_router(locations_router)
app.include_router(intentions_router)
app.include_router(extractions_router)
app.include_router(documents_router)
app.include_router(security_router)
app.include_router(tasks_router)
app.include_router(digitization_lists_router)
app.include_router(catalogs_router)
app.include_router(categories_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="fine",
    )
