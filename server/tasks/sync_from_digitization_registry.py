from sqlalchemy.orm import Session
from models import Document
from services.external.digitization_registry import DigitizationState
from tasks.documents_processing import run_task
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from services.documents_indexer import DocumentsIndexer


def SyncFromDigitizationRegistry(session: Session, task_id: int):
    indexer = DocumentsIndexer.get_instance()

    def update_document_from_digitization_registry(document: Document):
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

        indexer.index(document)

    run_task(session, task_id, update_document_from_digitization_registry)
