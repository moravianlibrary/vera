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
                            db: Session):
    for document_id in get_extraction(extraction_id, db).document_ids:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=extraction_id))
    db.commit()


def unset_documents_extracted(extraction_id: int,
                              db: Session):
    for document_id in get_extraction(extraction_id, db).document_ids:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=None))
    db.commit()


def get_category_documents(category_id: int,
                           db: Session):
    return db.query(Document.id, Document.pages_count).filter(
        Document.category_id == category_id,
        Document.pages_count.is_not(None),
        Document.extraction_id.is_(None),
    ).all()


def get_extraction(extraction_id: int,
                   db: Session):
    return (db.query(models.Extraction)
            .filter(models.Extraction.id == extraction_id).first())


def get_extractions(db: Session,
                    offset: int = 0,
                    limit: int = 50):
    return (db.query(models.Extraction)
            .offset(offset).limit(limit)
            .all())


def get_extractions_num_found(db: Session):
    return db.query(models.Extraction).count()
