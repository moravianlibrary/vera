from sqlalchemy.orm import Session
from sqlalchemy import desc, update
from typing import List, Optional

from services.database import create
from models.documents import Document
from extractions.digitization.models import DigitizationExtraction
from services.exceptions import EmptyExtraction


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


def add_documents_to_extraction(
    extraction_id: int,
    document_ids: List[int],
    extracted_pages: int,
    db: Session,
):
    db_extraction = get_extraction(extraction_id, db)
    db_document_ids = db_extraction.document_ids
    db_extracted_pages = db_extraction.extracted_pages

    for document_id in document_ids:
        if document_id not in db_document_ids:
            set_document_extracted(document_id, extraction_id, db)

    db.execute(
        update(DigitizationExtraction)
        .where(DigitizationExtraction.id == extraction_id)
        .values(
            document_ids=document_ids + db_document_ids,
            extracted_pages=extracted_pages + db_extracted_pages,
        )
    )
    db.commit()
    return get_extraction(extraction_id, db)


def remove_documents_from_extraction(
    extraction_id: int,
    document_ids: List[int],
    pages_count: int,
    db: Session,
):
    db_extraction = get_extraction(extraction_id, db)
    db_document_ids = db_extraction.document_ids
    db_extracted_pages = db_extraction.extracted_pages

    if pages_count is None or pages_count == db_extracted_pages:
        raise EmptyExtraction

    for document_id in document_ids:
        unset_document_extracted(document_id, extraction_id, db)

    new_document_ids = [
        document_id
        for document_id in db_document_ids
        if document_id not in document_ids
    ]
    db.execute(
        update(DigitizationExtraction)
        .where(DigitizationExtraction.id == extraction_id)
        .values(
            document_ids=new_document_ids,
            extracted_pages=db_extracted_pages - pages_count,
        )
    )
    db.commit()
    return get_extraction(extraction_id, db)


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
