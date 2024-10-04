from sqlalchemy.orm import Session
from models import TaskItem
from services.external.digitization_registry import DigitizationState
from tasks.run_items_processing import run_items_processing_task
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from schemas import IndexDocument
from services.elasticsearch import get_es_session


def SyncDocumentsWithDigitizationRegistry(session: Session, task_id: int):
    es_session = next(get_es_session())

    def update_document_from_digitization_registry(
        task_item: TaskItem,
    ) -> None:
        document = task_item.document

        record = DigitizationRegistryClient().get_record(
            document.barcode,
            document.cnb,
            document.isxn,
            document.volume,
            document.volume_year,
            document.bundle,
        )

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
