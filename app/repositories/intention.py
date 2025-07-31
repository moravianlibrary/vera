from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from schemas.intention import Intention, IntentionEdit

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import (
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    GetByIdsMixin,
)
from .models.intention import IntentionModel


class IntentionRepository(
    DbIndexedRepository[IntentionModel, Intention],
    GetByIdMixin[IntentionModel, int],
    GetByIdsMixin[IntentionModel, int],
    EnforceNameUniquenessMixin[IntentionModel, int],
):
    def __init__(
        self, db_session: DatabaseSession, indexer_session: IndexerSession
    ):
        super().__init__(
            "Intention", db_session, IntentionModel, indexer_session, Intention
        )

    def create(self, intention: IntentionEdit) -> IntentionModel:
        """
        Create a new intention.
        """
        self.enforce_name_uniqueness(intention.name)

        return self.save(
            IntentionModel(
                name=intention.name,
                description=intention.description,
                target_page_count=intention.target_page_count,
                start_date=intention.start_date,
                end_date=intention.end_date,
            )
        )

    def update(
        self, intention_model: IntentionModel, intention: IntentionEdit
    ) -> IntentionModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(intention.name, intention_model.id)

        intention_model.name = intention.name
        intention_model.description = intention.description
        intention_model.target_page_count = intention.target_page_count
        intention_model.start_date = intention.start_date
        intention_model.end_date = intention.end_date

        return self.save(intention_model)

    def delete_with_check(
        self, intention_model: IntentionModel
    ) -> IntentionModel:
        """
        Delete an existing intention.
        """
        # TODO: Check if the intention is empty
        return self.delete(intention_model)
