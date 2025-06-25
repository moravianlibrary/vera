from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession

from ._base import BaseRepository
from ._mixins import GetByQueryMixin, SaveMixin, SearchAllMixin, SearchMixin
from .models.proposal import ProposalModel


class ProposalRepository(
    BaseRepository,
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
