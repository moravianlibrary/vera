from typing import Annotated, List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.watchlist import WatchlistTarget
from repositories import ProposalRepository
from repositories.watchlist import WatchlistRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.proposal import (
    ApproveProposalsParams,
    IngestProposalsResponse,
    ProposalCreate,
    ProposalHit,
    ProposalsBatchParams,
    RejectProposalsParams,
)
from schemas.task import Task
from schemas.watchlist import Watchlist, WatchlistPropertiesParams
from services import ProposalService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnProposalRepository,
    DependsOnProposalService,
    DependsOnWatchlistRepository,
    RestrictedQuery,
    RestrictedSearch,
    WithGlobalPermission,
    WithPermission,
)

router = APIRouter(prefix="/proposals", tags=["Proposals"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadProposals)],
    response_model=IndexerResponse[ProposalHit],
)
async def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadProposals
    ),
    repository: ProposalRepository = DependsOnProposalRepository,
):
    return await repository.search(request)


@router.post(
    "/ingest",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
    response_model=IngestProposalsResponse,
)
async def ingest(
    proposals: List[ProposalCreate],
    batch_params: Annotated[ProposalsBatchParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return await service.ingest(proposals, batch_params, user.id)


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageProposals)],
    response_model=Task,
)
async def reingest(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return await service.reingest(query, user.id)


@router.post(
    "/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
    response_model=Task,
)
async def approve(
    approve_params: Annotated[ApproveProposalsParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return await service.approve(query, approve_params, user.id)


@router.post(
    "/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
    response_model=Task,
)
async def reject(
    reject_params: Annotated[RejectProposalsParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return await service.reject(query, reject_params, user.id)


@router.post(
    "/delete",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageProposals,
            GeneralPermission.DeleteProposals,
        )
    ],
    response_model=Task,
)
async def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return await service.delete(query, user.id)


@router.post(
    "/watchlist",
    dependencies=[
        WithPermission(GeneralPermission.ManageWatchlists),
        WithGlobalPermission(OwnershipPermission.ReadProjects),
    ],
    response_model=Watchlist,
)
async def create_watchlist(
    query: IndexerQuery,
    params: Annotated[WatchlistPropertiesParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return await repository.create(params, WatchlistTarget.Proposals, query)
