from .locations import router as locations_router
from .intentions import router as intentions_router
from .extractions import router as extractions_router
from .documents import router as documents_router
from .security import router as security_router
from .tasks import router as tasks_router
from .digitization_lists import router as digitization_lists_router
from .catalogs import router as catalogs_router
from .categories import router as categories_router

__all__ = [
    "locations_router",
    "intentions_router",
    "extractions_router",
    "documents_router",
    "security_router",
    "tasks_router",
    "digitization_lists_router",
    "catalogs_router",
    "categories_router",
]
