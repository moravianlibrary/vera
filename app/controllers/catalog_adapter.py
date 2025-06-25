from fastapi import APIRouter
from marcdantic.query import MarcSearchRequest

from controllers._resources import DependsOnCatalogSearchService
from definitions.permission import GeneralPermission
from services.catalog_search import CatalogSearchService

from ._security import WithPermission

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.SearchCatalog)],
    response_model=None,
)
def search(
    request: MarcSearchRequest,
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.search(request)


@router.get(
    "/{base}/{system_number}",
)
def get_record(
    base: str,
    system_number: str,
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.get_record(base, system_number)
