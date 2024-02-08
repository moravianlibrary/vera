from sqlalchemy.orm import Session
from sqlalchemy import update
from typing import List

from services.database import create
from documents.models import Document
from extractions import models
from services.exceptions import EmptyExtraction


def create_extraction(username: str,
                      document_ids: List[int],
                      db: Session):
    if not document_ids:
        raise EmptyExtraction

    return create(db, models.Extraction(
        extractor=username,
        document_ids=document_ids
    ))


def set_documents_extracted(extraction_id: int,
                            document_ids: List[int],
                            db: Session):
    for document_id in document_ids:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=extraction_id))


def get_category_documents(category_id: int,
                           db: Session):
    return db.query(Document.id, Document.pages_count).filter(
        Document.category_id == category_id,
        Document.pages_count.is_not(None),
        Document.extraction_id.is_(None),
    ).all()
