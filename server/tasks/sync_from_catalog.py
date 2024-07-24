from sqlalchemy.orm import Session
from models import CatalogRecord, Document
from tasks.documents_processing import run_task
from procedures.update_catalog_record import update_catalog_record
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from services.external.aleph.types import AlephResponseStatus
from services.documents_indexer import DocumentsIndexer


def sync_from_catalog(task_id: int, owner: str, session: Session):
    updated_records_sysno = set()

    def update_document_from_catalog(document: Document):
        if document.sysno not in updated_records_sysno:
            catalog_record, aleph_response_status = update_catalog_record(
                session, document.sysno
            )

            if aleph_response_status != AlephResponseStatus.Success:
                raise Exception(
                    f"Record with sysno {document.sysno} is not available "
                    f"from Aleph. Status: {aleph_response_status}."
                )

            updated_records_sysno.add(document.sysno)
        else:
            catalog_record = CatalogRecord.get(session, document.sysno)

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

        document.barcode = aleph_issue.barcode
        document.volume = aleph_issue.volume
        document.volume_year = aleph_issue.volume
        document.bundle = aleph_issue.bundle
        document.document_signature = aleph_issue.signature
        document.pages_count_aleph = aleph_record.parse_page_count(
            aleph_issue.volume
        )

        document.save(session)

        DocumentsIndexer().index(catalog_record, document)

    run_task(task_id, update_document_from_catalog, session)
