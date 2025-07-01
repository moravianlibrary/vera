from typing import Optional

from marcdantic import MarcIssue

from adapters.database import DatabaseSession
from repositories.models.document import DocumentModel, DocumentPropertyModel

from ._base import BaseRepository
from ._mixins import DeleteMixin, GetByIdMixin, SaveMixin


class DocumentRepository(
    BaseRepository,
    DeleteMixin[DocumentModel],
    GetByIdMixin[DocumentModel, int],
    SaveMixin[DocumentModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, DocumentModel, "Document")

    def create(
        self,
        catalog_record_id: str,
        marc_issue: Optional[MarcIssue] = None,
    ) -> DocumentModel:
        if marc_issue is None:
            return self.save(
                DocumentModel(catalog_record_id=catalog_record_id)
            )

        return self.save(
            DocumentModel(
                catalog_record_id=catalog_record_id,
                barcode=marc_issue.barcode,
                volume_number=marc_issue.volume_number,
                volume_year=marc_issue.volume_year,
                bundle=marc_issue.bundle,
                issuance_type=marc_issue.issuance_type,
            )
        )

    def update(
        self, document_model: DocumentModel, marc_issue: MarcIssue
    ) -> DocumentModel:
        document_model.volume_number = marc_issue.volume_number
        document_model.volume_year = marc_issue.volume_year
        document_model.bundle = marc_issue.bundle
        document_model.issuance_type = marc_issue.issuance_type

        return self.save(document_model)

    def update_page_count(
        self,
        document_model: DocumentModel,
        source: str,
        page_count: Optional[int],
        top_priority: bool,
    ) -> DocumentModel:
        document_model.page_count_sources[source] = page_count

        if top_priority:
            document_model.page_count = page_count

        return self.save(document_model)

    def use_page_count_source(
        self, document_model: DocumentModel, source: str
    ) -> DocumentModel:
        if source not in document_model.page_count_sources:
            raise ValueError(
                f"Source '{source}' not found in page count sources."
            )

        document_model.page_count = document_model.page_count_sources[source]
        return self.save(document_model)

    def update_property(
        self,
        document_model: DocumentModel,
        property_key: str,
        property_value: Optional[str],
    ) -> DocumentModel:
        for prop in document_model.properties:
            if prop.key == property_key:
                prop.value = property_value
                break
        else:
            document_model.properties.append(
                DocumentPropertyModel(key=property_key, value=property_value)
            )

        return self.save(document_model)

    def delete_property(
        self, document_model: DocumentModel, property_key: str
    ) -> DocumentModel:
        document_model.properties = [
            prop
            for prop in document_model.properties
            if prop.key != property_key
        ]
        return self.save(document_model)

    def find_by_barcode(self, barcode: str) -> Optional[DocumentModel]:
        return (
            self._database_session.query(DocumentModel)
            .filter(DocumentModel.barcode == barcode)
            .one_or_none()
        )
