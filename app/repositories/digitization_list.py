from requests import Session

from ._base import BaseRepository
from ._mixins import DeleteMixin, GetByIdMixin, SaveMixin, SearchMixin
from .models.digitization_list import DigitizationListModel


class DigiListRepository(
    BaseRepository,
    DeleteMixin[DigitizationListModel],
    GetByIdMixin[DigitizationListModel, int],
    SaveMixin[DigitizationListModel],
    SearchMixin[DigitizationListModel, int],
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, DigitizationListModel, "DigitizationList")
