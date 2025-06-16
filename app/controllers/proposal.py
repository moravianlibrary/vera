from fastapi import APIRouter

from adapters.indexer import IndexerQuery, IndexerResponse
from custom_types import GeneralPermission
from repositories import ProposalRepository
from services import ProposalService

from ._resources import (
    DependsOnProposalRepository,
    DependsOnProposalService,
    RestrictedQuery,
)
from ._security import WithPermission

router = APIRouter(prefix="/proposals", tags=["Proposals"])


@router.post(
    "/search",
    dependencies=[
        WithPermission(
            GeneralPermission.ProposeDocuments,
            GeneralPermission.ReviewDocumentProposals,
        )
    ],
    response_model=IndexerResponse,
)
def search(
    query: IndexerQuery = RestrictedQuery(),
    repository: ProposalRepository = DependsOnProposalRepository,
):
    pass


@router.post(
    "/propose",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
)
def propose(
    # proposals: List[DirectProposal],
    service: ProposalService = DependsOnProposalService,
):
    pass


@router.post(
    "/enqueue-proposals",
    dependencies=[WithPermission(GeneralPermission.ProposeDocuments)],
)
def enqueue_proposals(
    # proposals: List[AsyncProposal],
    service: ProposalService = DependsOnProposalService,
):
    pass


@router.post(
    "/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
)
def approve(
    query: IndexerQuery,
    service: ProposalService = DependsOnProposalService,
):
    pass


@router.post(
    "/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
)
def reject(
    query: IndexerQuery,
    service: ProposalService = DependsOnProposalService,
):
    pass


@router.post(
    "/archive",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
)
def archive(
    query: IndexerQuery,
    service: ProposalService = DependsOnProposalService,
):
    pass


@router.post(
    "/delete",
    dependencies=[WithPermission(GeneralPermission.ReviewProposals)],
)
def delete():
    pass
