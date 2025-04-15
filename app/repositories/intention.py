from requests import Session

from schemas import IntentionEdit

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models import IntentionModel


class IntentionRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session):
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
        self, intention_id: int, intention: IntentionEdit
    ) -> IntentionModel:
        """
        Update an existing role.
        """
        intention_model: IntentionModel = self.get_by_id(intention_id)

        self.enforce_name_uniqueness(intention.name, intention_id)

        intention_model.name = intention.name
        intention_model.description = intention.description
        intention_model.target_page_count = intention.target_page_count
        intention_model.start_date = intention.start_date
        intention_model.end_date = intention.end_date

        return self.save(intention_model)
