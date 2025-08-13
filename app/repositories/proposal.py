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
    _entity_name = "Proposal"
    _db_model = ProposalModel
    _indexer_model = Proposal
