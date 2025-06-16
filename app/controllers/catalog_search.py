from fastapi import APIRouter
from marcdantic.query import MarcSearchRequest

from controllers._resources import DependsOnCatalogSearchService
from definitions.permission import GeneralPermission
from services.catalog_search import CatalogSearchService

from ._security import WithPermission

router = APIRouter(prefix="/catalog-search", tags=["Catalog Search"])


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.SearchCatalog)],
    response_model=None,
)
def search(
    request: MarcSearchRequest,
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.search(request)
