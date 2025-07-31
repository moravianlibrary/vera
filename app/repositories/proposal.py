from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from schemas.proposal import Proposal

from ._db_indexed_repository import (
    DbIndexedRepository,
    GetByQueryMixin,
    SearchAllMixin,
)
from .models.proposal import ProposalModel


class ProposalRepository(
    DbIndexedRepository[ProposalModel, Proposal],
    GetByQueryMixin[ProposalModel, Proposal],
    SearchAllMixin[ProposalModel, Proposal],
):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(
            "Proposal",
            database_session,
            ProposalModel,
            indexer_session,
            Proposal,
        )
