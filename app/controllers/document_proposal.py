from fastapi import APIRouter, Path, Query

from custom_types import GeneralPermission, OwnershipPermission
from repositories import DistributionRepository
from schemas import AuthenticatedUser, EsQuery, EsResponse
from services import DistributionService

from ._resources import (
    DependsOnDistributionRepository,
    DependsOnDistributionService,
)
from .security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/document-proposals", tags=["Document Proposals"])


@router.post(
    "",
    dependencies=[
        WithPermission(
            GeneralPermission.ProposeDocuments,
            GeneralPermission.ReviewDocumentProposals,
        )
    ],
    response_model=EsResponse[],
)
def search(
    query: EsQuery,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: DocumentProposalRepository = DependsOnDocumentProposalRepository,
):
    return repository.search(restrict_proposals_query(query))


@router.post(
    "/propose",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
    response_model=Distribution,
)
def propose(
    proposals: List[DirectDocumentProposal],
    service: DocumentProposalService = DependsOnDocumentProposalService,
):
    return service.propose(proposals)


@router.post(
    "/enqueue-proposals",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
    response_model=Distribution,
)
def enqueue_proposals(
    proposals: List[AsyncDocumentProposal],
    service: DocumentProposalService = DependsOnDocumentProposalService,
):
    return service.enqueue_proposals(proposals)


@router.post(
    "/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewDocumentProposals)],
    response_model=Task,
)
def approve(
    query: EsQuery,
    service: DocumentProposalService = DependsOnDocumentProposalService,
):
    return service.approve(query)


@router.post(
    "/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewDocumentProposals)],
    response_model=Distribution,
)
def reject():
    pass


@router.post(
    "/archive",
    dependencies=[WithPermission(GeneralPermission.ReviewDocumentProposals)],
    response_model=Distribution,
)
def archive():
    pass


@router.post(
    "/delete",
    dependencies=[WithPermission(GeneralPermission.ReviewDocumentProposals)],
    response_model=Distribution,
)
def delete():
    pass
