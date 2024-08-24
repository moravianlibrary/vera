import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import routers
from config import VeraConfig
from vera_lifespan import lifespan


logger = logging.getLogger("uvicorn")


# TODO: fix logging.
# TODO: add support to logger editing of documents
# TODO: add checking unique before insert and update


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
        host=VeraConfig.VeraUrl,
        port=VeraConfig.VeraPort,
        log_level=VeraConfig.LogLevel,
    )
