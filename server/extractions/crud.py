from sqlalchemy.orm import Session
from sqlalchemy import update

from services.database import create
from documents.models import Document
from extractions import models, schemas


def create_extraction(extraction: schemas.ExtractionCreate,
                      user_id: int,
                      db: Session):
    if not extraction.extracted_documents:
        return

    db_extraction = create(db, models.Extraction(
        extractor_id=user_id
    ))

    for document_id in extraction.extracted_documents:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=db_extraction.id))

    return db_extraction


def get_category_documents(category_id: int,
                           db: Session):
    return db.query(models.Document).filter(
        models.Document.category_id == category_id,
        models.Document.extracted.is_(False),
    ).all()
