from adapters.database import DatabaseSession
from schemas.intention import Intention, IntentionEdit

from ._base import BaseRepository
from ._database_mixins import (
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    GetByIdsMixin,
    SaveMixin,
    SearchMixin,
)
from .models.intention import IntentionModel


class IntentionRepository(
    BaseRepository,
    EnforceNameUniquenessMixin[IntentionModel, int],
    GetByIdMixin[IntentionModel, int],
    GetByIdsMixin[IntentionModel, int],
    SaveMixin[IntentionModel],
    SearchMixin[Intention],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, IntentionModel, "Intention")

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

    def delete(self, intention_model: IntentionModel) -> IntentionModel:
        """
        Delete an existing intention.
        """
        # TODO: Check if the intention is empty
        return self.delete_model(intention_model)
