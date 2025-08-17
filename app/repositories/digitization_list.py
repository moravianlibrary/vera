from typing import List, Type

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
    _indexer_model: Type[DigitizationList] = DigitizationList

    def create(
        self, created_by: str, intentions: List[IntentionModel]
    ) -> DigitizationListModel:
        digitization_list = DigitizationListModel(created_by=created_by)
        digitization_list.intentions = intentions

        return self.save(digitization_list)

    def change_intentions(
        self,
        digitization_list: DigitizationListModel,
        intentions: List[IntentionModel],
    ) -> DigitizationListModel:
        digitization_list.intentions = intentions

        return self.save(digitization_list)
