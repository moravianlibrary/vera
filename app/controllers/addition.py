from typing import Annotated, List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.watchlist import WatchlistTarget
from repositories import AdditionRepository
from repositories.watchlist import WatchlistRepository
from schemas.addition import (
    AdditionCreate,
    AdditionsSettingsParams,
    IngestAdditionsParams,
    IngestAdditionsResponse,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.task import Task
from schemas.watchlist import Watchlist, WatchlistPropertiesParams
from services import AdditionService

from .resources import (
    DependsOnAdditionRepository,
    DependsOnAdditionService,
    DependsOnAuthenticatedUser,
    DependsOnWatchlistRepository,
    RestrictedParams,
    RestrictedQuery,
    RestrictedSearch,
    WithGlobalPermission,
    WithPermission,
)

router = APIRouter(prefix="/additions", tags=["Additions"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadAdditions)],
    response_model=IndexerResponse,
)
async def search(
    query: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadAdditions
    ),
    repository: AdditionRepository = DependsOnAdditionRepository,
):
    return await repository.search(query)


@router.post(
    "/ingest",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=IngestAdditionsResponse,
)
async def ingest(
    additions: List[AdditionCreate],
    params: Annotated[IngestAdditionsParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return await service.ingest(
        additions, params.batch, params.settings, user.id
    )


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageAdditions)],
    response_model=Task,
)
async def reingest(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    ingest_params: AdditionsSettingsParams = RestrictedParams(
        GeneralPermission.IgnoreAdditionChecks, AdditionsSettingsParams
    ),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return await service.reingest(query, ingest_params, user.id)


@router.post(
    "/delete",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageAdditions,
            GeneralPermission.DeleteAdditions,
        )
    ],
    response_model=Task,
)
async def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return await service.delete(query, user.id)


@router.post(
    "/watchlist",
    dependencies=[
        WithPermission(GeneralPermission.ManageWatchlists),
        WithGlobalPermission(OwnershipPermission.ReadAdditions),
    ],
    response_model=Watchlist,
)
async def create_watchlist(
    query: IndexerQuery,
    params: Annotated[WatchlistPropertiesParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return await repository.create(params, WatchlistTarget.Additions, query)
