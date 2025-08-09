from typing import Annotated, List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import ProposalRepository
from schemas.addition import AdditionsSettingsParams
from schemas.authenticated_user import AuthenticatedUser
from schemas.proposal import Proposal, ProposalBatchParams, ProposalCreate
from schemas.task import Task
from services import ProposalService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnProposalRepository,
    DependsOnProposalService,
    RestrictedQuery,
    RestrictedSearch,
    WithPermission,
)

router = APIRouter(prefix="/proposals", tags=["Proposals"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadProposals)],
    response_model=IndexerResponse[Proposal],
)
def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadProposals
    ),
    repository: ProposalRepository = DependsOnProposalRepository,
):
    return repository.search(request)


@router.post(
    "/ingest",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
    response_model=Task,
)
def ingest(
    proposals: List[ProposalCreate],
    batch_params: Annotated[ProposalBatchParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.ingest(proposals, batch_params, user.id)


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageProposals)],
    response_model=Task,
)
def reingest(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.reingest(query, user.id)


@router.post(
    "/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
    response_model=Task,
)
def approve(
    ingest_additions_params: Annotated[AdditionsSettingsParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.approve(query, ingest_additions_params, user.id)


@router.post(
    "/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
    response_model=Task,
)
def reject(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.reject(query, user.id)


@router.post(
    "/archive",
    dependencies=[WithPermission(OwnershipPermission.ManageProposals)],
    response_model=Task,
)
def archive(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.archive(query, user.id)


@router.delete(
    "",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageProposals,
            GeneralPermission.DeleteProposals,
        )
    ],
    response_model=Task,
)
def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageProposals),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProposalService = DependsOnProposalService,
):
    return service.delete(query, user.id)
