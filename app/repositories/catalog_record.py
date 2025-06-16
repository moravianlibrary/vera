from requests import Session

from ._base import BaseRepository
from ._mixins import SaveMixin
from .models.catalog_record import CatalogRecordModel


class CatalogRecordRepository(
    BaseRepository,
    SaveMixin[CatalogRecordModel],
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, CatalogRecordModel, "Catalog Record")
