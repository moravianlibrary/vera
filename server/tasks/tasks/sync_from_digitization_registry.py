from sqlalchemy.orm import Session

from models.documents import Document
from services.external.digitization_registry.types import DigitizationState
from tasks.tasks.documents_processing import run_task
from services.external.digitization_registry.client import (
    DigitizationRegistryClient,
)


def sync_from_digitization_registry(
    task_id: int, owner: str, session: Session
):
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

        session.commit()

    run_task(task_id, update_document_from_digitization_registry, session)
