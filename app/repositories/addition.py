from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from schemas.addition import Addition, AdditionCreate

from ._base import BaseRepository
from ._mixins import SaveMixin, SearchAllMixin, SearchMixin
from .models.addition import AdditionModel


class AdditionRepository(
    BaseRepository,
    SaveMixin[AdditionModel],
    SearchMixin[Addition],
    SearchAllMixin[Addition],
):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(
            "Addition",
            database_session,
            AdditionModel,
            indexer_session,
            Addition,
        )

    def create(
        self,
        addition: AdditionCreate,
        created_by: str,
        proposal_id: int | None = None,
    ) -> AdditionModel:
        return self.save(
            AdditionModel(
                identifier_type=addition.identifier_type,
                identifier_value=addition.identifier_value,
                batch_name=addition.batch_name,
                category_id=addition.category_id,
                priority=addition.priority,
                proposal_id=proposal_id,
                created_by=created_by,
            )
        )
