from sqlalchemy.orm import Session

from models import Document
from tasks.tasks.documents_processing import run_task
from crud.catalog_records import get_catalog_record_by_sysno
from crud.documents import update_document_identifiers
from procedures.update_catalog_record import update_catalog_record
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from services.external.aleph.types import AlephResponseStatus
from schemas.catalog_records import CatalogRecord
from services.documents_indexer import DocumentsIndexer


def sync_from_catalog(task_id: int, owner: str, session: Session):
    updated_records_sysno = set()

    def update_document_from_catalog(document: Document):
        if document.sysno not in updated_records_sysno:
            catalog_record, aleph_response_status = update_catalog_record(
                session, document.sysno
            )

            if aleph_response_status != AlephResponseStatus.Success:
                raise ValueError(
                    f"Record with sysno {document.sysno} is not available "
                    f"from Aleph. Status: {aleph_response_status}."
                )

            updated_records_sysno.add(document.sysno)
        else:
            catalog_record = get_catalog_record_by_sysno(
                session, document.sysno
            )

        aleph_record = AlephRecord(
            catalog_record.sysno,
            CatalogRecord.convert_to_record(catalog_record.marc),
        )

        aleph_issue = AlephIssue.specific_issue_from_record(
            aleph_record, catalog_record.barcode, catalog_record.volume
        )
        if aleph_issue is None:
            raise ValueError(
                f"Issue with barcode {document.barcode} not found in Aleph"
            )

        update_document_identifiers(
            session, document.id, aleph_record, aleph_issue
        )

        DocumentsIndexer().index(catalog_record, document)

    run_task(task_id, update_document_from_catalog, session)
