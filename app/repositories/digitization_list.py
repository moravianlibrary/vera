from typing import List

from adapters.database import DatabaseSession
from repositories.models.intention import IntentionModel

from ._db_repository import (
    DbRepository,
    DeleteMixin,
    GetByIdMixin,
    SaveMixin,
    SearchMixin,
)
from .models.digitization_list import DigitizationListModel


class DigiListRepository(
    DbRepository,
    DeleteMixin[DigitizationListModel],
    GetByIdMixin[DigitizationListModel, int],
    SaveMixin[DigitizationListModel],
    SearchMixin[DigitizationListModel],
):
    def __init__(self, database_session: DatabaseSession):
        super().__init__(
            database_session, DigitizationListModel, "Digitization List"
        )

    def create(
        self, created_by: str, intentions: List[IntentionModel]
    ) -> DigitizationListModel:
        digi_list_model = self.save(
            DigitizationListModel(created_by=created_by)
        )
        digi_list_model.intentions = intentions

        self._database_session.commit()

        return digi_list_model

    def change_intentions(
        self,
        digitization_list_model: DigitizationListModel,
        intentions: List[IntentionModel],
    ) -> DigitizationListModel:
        digitization_list_model.intentions = intentions
        self._database_session.commit()
        return digitization_list_model
