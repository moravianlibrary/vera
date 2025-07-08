from typing import List

from fastapi import APIRouter
from marcdantic.query import MarcSearchRequest
from vera_plugins.specs.catalog_adapter import (
    SearchResult,
    SearchResultResponse,
)

from controllers.resources import DependsOnCatalogSearchService
from definitions.permission import GeneralPermission
from services.catalog_search import CatalogSearchService

from .resources import WithPermission

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get(
    "/search-settings",
    dependencies=[WithPermission(GeneralPermission.SearchCatalog)],
    response_model=List[str],
)
def get_search_settings(
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.get_search_settings()


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.SearchCatalog)],
    response_model=SearchResultResponse,
)
def search(
    request: MarcSearchRequest,
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.search(request)


@router.get(
    "/{base}/{system_number}",
    dependencies=[WithPermission(GeneralPermission.SearchCatalog)],
    response_model=SearchResult | None,
)
def get_record(
    base: str,
    system_number: str,
    service: CatalogSearchService = DependsOnCatalogSearchService,
):
    return service.get_record(base, system_number)
