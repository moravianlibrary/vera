from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, update
from typing import List, Optional

from services.database import create
from documents.models import Document
from extractions import models
from services.exceptions import EmptyExtraction


def create_extraction(username: str,
                      target_pages: int,
                      extracted_pages: int,
                      document_ids: List[int],
                      db: Session):
    if not document_ids:
        raise EmptyExtraction

    return create(db, models.Extraction(
        extractor=username,
        target_pages=target_pages,
        extracted_pages=extracted_pages,
        document_ids=document_ids
    ))


def set_documents_extracted(extraction_id: int,
                            db: Session):
    for document_id in get_extraction(extraction_id, db).document_ids:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=extraction_id))
    db.execute(update(models.Extraction)
               .where(models.Extraction.id == extraction_id)
               .values(marked=True))
    db.commit()


def unset_documents_extracted(extraction_id: int,
                              db: Session):
    for document_id in get_extraction(extraction_id, db).document_ids:
        db.execute(update(Document).where(Document.id == document_id)
                   .values(extraction_id=None))
    db.execute(update(models.Extraction)
               .where(models.Extraction.id == extraction_id)
               .values(marked=False))
    db.commit()


def get_category_documents(category_id: int,
                           db: Session):
    return db.query(Document.id, Document.pages_count).filter(
        Document.category_id == category_id,
        Document.pages_count.is_not(None),
        Document.extraction_id.is_(None),
    ).all()


def get_extraction_documents(extraction_id: int,
                             db: Session,
                             category_id: Optional[int] = None):
    query_base = (
        db.query(Document.id, Document.pages_count, Document.category_id)
        .join(models.Extraction, and_(
            models.Extraction.id == extraction_id,
            models.Extraction.document_ids.any(Document.id)
        ))
    )
    if category_id:
        query_base = query_base.filter(
            Document.category_id == category_id
        )
    return query_base.all()


def get_extraction(extraction_id: int,
                   db: Session):
    return (db.query(models.Extraction)
            .filter(models.Extraction.id == extraction_id).first())


def get_extractions(db: Session,
                    offset: int = 0,
                    limit: int = 50) -> List[models.Extraction]:
    return (db.query(models.Extraction)
            .order_by(desc(models.Extraction.id))
            .offset(offset).limit(limit)
            .all())


def get_extractions_num_found(db: Session):
    return db.query(models.Extraction).count()
