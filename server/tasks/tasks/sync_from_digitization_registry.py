from sqlalchemy.orm import Session

from models.documents import Document
from tasks.tasks.documents_processing import run_task


def sync_from_digitization_registry(task_id: int, owner: str, db: Session):
    from catalogs.digitization_registry.digitization_registry import (
        DigitizationRegistry,
    )

    def update_document_from_digitization_registry(document: Document):
        state = DigitizationRegistry(
            document.barcode,
            document.cnb,
            document.isbn_issn,
            document.year,
            document.volume,
            document.bundle,
        )
        document.digitization_state = state
        db.commit()

    run_task(task_id, update_document_from_digitization_registry, db)
