from mzk_aleph import AlephMzkIssue, AlephMzkRecord
from sqlalchemy.orm import Session

from adapters.elasticsearch import with_es_session
from models import CatalogRecord, Document, TaskItem
from schemas import EsSession, IndexDocument

from .run_items_processing import run_items_processing_task
from .subtasks import update_catalog_record


@with_es_session
def SyncDocumentsWithCatalogs(
    es_session: EsSession, session: Session, task_id: int
):
    updated_records_sysno = set()

    def update_document_from_catalog(item: TaskItem):
        document = item.document
        document: Document

        if document.sysno not in updated_records_sysno:
            catalog_record = update_catalog_record(
                session, es_session, CatalogRecord.get(session, document.sysno)
            )

            updated_records_sysno.add(document.sysno)
        else:
            catalog_record = CatalogRecord.get(session, document.sysno)

        aleph_record = AlephMzkRecord(
            catalog_record.main_record, sysno=catalog_record.sysno
        )

        aleph_issue = AlephMzkIssue.specific_issue_from_record(
            aleph_record.record, document.barcode, document.volume
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
        document.pages_count_catalog = aleph_record.parse_page_count(
            aleph_issue.volume
        )

        document.save(session)
        IndexDocument.model_validate(document).save(es_session)

    run_items_processing_task(session, task_id, update_document_from_catalog)
