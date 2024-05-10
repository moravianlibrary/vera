from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
from os import environ

import routing
import categories.router as categories_router
import categories.quotas.router as quotas_router
import documents.router as documents_router
import extractions.digitization.router as digitization_extractions_router
import extractions.generated.router as generated_extractions_router
import extractions.locations.router as locations_router
import routing.security
import tasks.router as tasks_router


logger = logging.getLogger("uvicorn")


# TODO: fix logging.
# TODO: add support to logger editing of documents
# TODO: add checking unique before insert and update


@asynccontextmanager
async def lifespan(app_: FastAPI):
    from services.database import check_connection, check_database_revision

    logger.info("Checking database connection.")
    if not check_connection():
        logger.info("Database connection failed. Exiting.")
        return
    logger.info("Database connection successfully established.")
    check_database_revision()
    yield
    logger.info("Shutting down.")


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=(environ.get("ALLOW_ORIGINS").split(",")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(routing.security.router)
app.include_router(categories_router.router)
app.include_router(quotas_router.router)
app.include_router(documents_router.router)
app.include_router(digitization_extractions_router.router)
app.include_router(generated_extractions_router.router)
app.include_router(locations_router.router)
app.include_router(tasks_router.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="fine",
    )
