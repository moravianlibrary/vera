from sqlalchemy.orm import Session
from models import TaskItem, Document
from services.external.digitization_registry import DigitizationState
from tasks.run_items_processing import run_items_processing_task
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from schemas import IndexDocument, EsSession
from services.elasticsearch import with_es_session


@with_es_session
def SyncDocumentsWithDigitizationRegistry(
    es_session: EsSession, session: Session, task_id: int
):
    client = DigitizationRegistryClient()

    def update_document_from_digitization_registry(
        task_item: TaskItem,
    ) -> None:
        document: Document = task_item.document

        records = client.get_issue_records(
            document.cnb,
            document.isxn,
        )

        record = (
            client.select_volume_record(
                records,
                document.barcode,
                document.volume_year,
                document.volume,
                document.bundle,
            )
            if records
            else None
        )

        if not record:
            record = client.get_record_by_barcode(document.barcode)

        if not record:
            document.digitization_registry_id = None
            document.digitization_state = DigitizationState.NotDigitized
        else:
            document.digitization_registry_id = record.id
            document.digitization_state = record.digitization_state

        document.save(session)
        IndexDocument.model_validate(document).save(es_session)

    run_items_processing_task(
        session, task_id, update_document_from_digitization_registry
    )
