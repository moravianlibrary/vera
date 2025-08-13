from marcdantic import MarcRecord

from schemas.catalog_record import CatalogRecord

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import GetByIdMixin
from .models.catalog_record import CatalogRecordModel


class CatalogRecordRepository(
    DbIndexedRepository[CatalogRecordModel, CatalogRecord],
    GetByIdMixin[CatalogRecordModel, str],
):
    _entity_name = "CatalogRecord"
    _db_model = CatalogRecordModel
    _indexer_model = CatalogRecord

    def create(
        self,
        base: str,
        system_number: str,
        marc_record: MarcRecord,
    ) -> CatalogRecordModel:
        return self.save(
            CatalogRecordModel(
                id=f"{base}-{system_number}",
                base=base,
                system_number=system_number,
                marc=marc_record.marc,
            )
        )
