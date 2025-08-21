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
    _entity_name = "Intention"
    _db_model = IntentionModel
    _indexer_model = Intention

    async def create(self, intention: IntentionEdit) -> IntentionModel:
        """
        Create a new intention.
        """
        self.enforce_name_uniqueness(intention.name)

        return await self.save(
            IntentionModel(
                name=intention.name,
                description=intention.description,
                target_page_count=intention.target_page_count,
                start_date=intention.start_date,
                end_date=intention.end_date,
            )
        )

    async def update(
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

        return await self.save(intention_model)
