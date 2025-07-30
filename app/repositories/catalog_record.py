from marcdantic import MarcRecord

from adapters.database import DatabaseSession

from ._db_repository import DbRepository, GetByIdMixin, SaveMixin
from .models.catalog_record import CatalogRecordModel


class CatalogRecordRepository(
    DbRepository,
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
