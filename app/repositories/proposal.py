from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from schemas.proposal import Proposal

from ._db_indexed_repository import (
    GetByQueryMixin,
    SearchAllMixin,
    SearchMixin,
)
from ._db_repository import DbRepository, SaveMixin
from .models.proposal import ProposalModel


class ProposalRepository(
    DbRepository,
    GetByQueryMixin[ProposalModel],
    SaveMixin[ProposalModel],
    SearchMixin[Proposal],
    SearchAllMixin[Proposal],
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
