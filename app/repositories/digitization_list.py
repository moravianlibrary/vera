from typing import List

from schemas.digitization_list import DigitizationList

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import GetByIdMixin
from .models.digitization_list import DigitizationListModel
from .models.intention import IntentionModel


class DigiListRepository(
    DbIndexedRepository[DigitizationListModel, DigitizationList],
    GetByIdMixin[DigitizationListModel, int],
):
    _entity_name = "DigitizationList"
    _db_model = DigitizationListModel
    _indexer_model = DigitizationList

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
