# pragma: exclude file
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import config

# import routing controllers
from controllers.addition import router as additions_router
from controllers.catalog_adapter import router as catalog_adapter_router
from controllers.catalog_record import router as catalog_records_router
from controllers.category import router as categories_router
from controllers.category import router as distributions_router
from controllers.digitization_list import router as digitization_lists_router
from controllers.document import router as documents_router
from controllers.group import router as groups_router
from controllers.intention import router as intentions_router
from controllers.plugin import router as plugins_router
from controllers.project import router as projects_router
from controllers.proposal import router as proposals_router
from controllers.role import router as roles_router
from controllers.system import router as system_router
from controllers.task import router as tasks_router
from controllers.user import router as users_router
from lifespan import lifespan

logger = logging.getLogger("uvicorn")


# TODO: fix logging.


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=(config.cors.allow_origins),
    allow_credentials=config.cors.allow_credentials,
    allow_methods=config.cors.allow_methods,
    allow_headers=config.cors.allow_headers,
)


app.include_router(additions_router)
app.include_router(catalog_adapter_router)
app.include_router(catalog_records_router)
app.include_router(categories_router)
app.include_router(digitization_lists_router)
app.include_router(distributions_router)
app.include_router(documents_router)
app.include_router(groups_router)
app.include_router(intentions_router)
app.include_router(plugins_router)
app.include_router(projects_router)
app.include_router(proposals_router)
app.include_router(roles_router)
app.include_router(system_router)
app.include_router(tasks_router)
app.include_router(users_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=config.app_url,
        port=config.app_port,
        log_level=config.log_level,
    )
