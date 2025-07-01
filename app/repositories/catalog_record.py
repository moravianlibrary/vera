from typing import List

from marcdantic import MarcRecord

from adapters.database import DatabaseSession
from definitions.identifier import IdentifierType

from ._base import BaseRepository
from ._mixins import GetByIdMixin, SaveMixin
from .models.catalog_record import (
    CatalogRecordIdentifierModel,
    CatalogRecordModel,
)


class CatalogRecordRepository(
    BaseRepository,
    SaveMixin[CatalogRecordModel],
    GetByIdMixin[CatalogRecordModel, str],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, CatalogRecordModel, "Catalog Record")

    def create(
        self,
        base: str,
        system_number: str,
        marc_record: MarcRecord,
    ) -> CatalogRecordModel:
        return self.save_and_index(
            CatalogRecordModel(
                id=f"{base}-{system_number}",
                base=base,
                system_number=system_number,
                marc=marc_record.marc,
            )
        )

    def find_by_identifier(
        self, identifier_type: IdentifierType, identifier_value: str
    ) -> List[CatalogRecordModel]:
        return [
            cri_model.catalog_record
            for cri_model in (
                self._database_session.query(CatalogRecordIdentifierModel)
                .filter(
                    CatalogRecordIdentifierModel.identifier_type
                    == identifier_type,
                    CatalogRecordIdentifierModel.identifier_value
                    == identifier_value,
                )
                .all()
            )
        ]
