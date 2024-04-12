from sqlalchemy.orm import Session
from sqlalchemy import desc, update
from typing import List, Optional

from services.database import create
from documents.models import Document
from extractions.digitization.models import DigitizationExtraction


def create_extraction(
    document_ids: List[int],
    extracted_pages: int,
    intention_id: Optional[int],
    username: str,
    db: Session,
):
    db_digitization = create(
        db,
        DigitizationExtraction(
            document_ids=document_ids,
            extracted_pages=extracted_pages,
            intention_id=intention_id,
            extractor=username,
        ),
    )
    for document_id in document_ids:
        set_document_extracted(document_id, db_digitization.id, db)
    return db_digitization


def get_extractions(
    db: Session, offset: int = 0, limit: int = 50
) -> List[DigitizationExtraction]:
    return (
        db.query(DigitizationExtraction)
        .order_by(desc(DigitizationExtraction.id))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_extractions_num_found(db: Session) -> int:
    return db.query(DigitizationExtraction).count()


def get_extraction(extraction_id: int, db: Session) -> DigitizationExtraction:
    return (
        db.query(DigitizationExtraction)
        .filter(DigitizationExtraction.id == extraction_id)
        .first()
    )


def delete_extraction(
    extraction_id: int, db: Session
) -> DigitizationExtraction:
    db_extraction = get_extraction(extraction_id, db)
    db.delete(db_extraction)
    db.commit()
    return db_extraction


def update_extraction(
    extraction_id: int,
    document_ids: List[int],
    extracted_pages: int,
    db: Session,
):
    db_document_ids = get_extraction(extraction_id, db).document_ids

    for document_id in document_ids:
        if document_id not in db_document_ids:
            set_document_extracted(document_id, extraction_id, db)
    for document_id in db_document_ids:
        if document_id not in document_ids:
            unset_document_extracted(document_id, extraction_id, db)

    db.execute(
        update(DigitizationExtraction)
        .where(DigitizationExtraction.id == extraction_id)
        .values(document_ids=document_ids, extracted_pages=extracted_pages)
    )
    db.commit()


def set_document_extracted(document_id: int, extraction_id: int, db: Session):
    db.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(extraction_id=extraction_id)
    )
    db.commit()


def unset_document_extracted(
    document_id: int, extraction_id: int, db: Session
):
    db.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(extraction_id=None)
    )
    db.commit()
