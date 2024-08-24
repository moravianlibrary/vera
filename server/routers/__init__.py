from .catalog_records import router as catalog_records_router
from .categories import router as categories_router
from .departments import router as departments_router
from .digitization_lists import router as digitization_lists_router
from .documents import router as documents_router
from .extractions import router as extractions_router
from .intentions import router as intentions_router
from .locations import router as locations_router
from .roles import router as roles_router
from .tasks import router as tasks_router
from .users import router as users_router

__all__ = [
    "catalog_records_router",
    "categories_router",
    "departments_router",
    "digitization_lists_router",
    "documents_router",
    "extractions_router",
    "intentions_router",
    "locations_router",
    "roles_router",
    "tasks_router",
    "users_router",
]
