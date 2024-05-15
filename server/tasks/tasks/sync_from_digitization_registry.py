from sqlalchemy.orm import Session

from documents.models import Document
from tasks.tasks.documents_processing import run_task


def sync_from_digitization_registry(task_id: int, owner: str, db: Session):
    from catalogs.digitization_registry import get_digitization_state

    def update_document_from_digitization_registry(document: Document):
        state = get_digitization_state(document.barcode, document.cnb)
        document.digitization_state = state
        db.commit()

    run_task(task_id, update_document_from_digitization_registry, db)
