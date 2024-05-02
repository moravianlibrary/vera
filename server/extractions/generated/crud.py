from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, or_
from typing import List, Optional

from services.database import create
from documents.models import Document
from extractions.generated import schemas
from extractions.generated.models import GeneratedExtraction
from services.exceptions import EmptyExtraction


def create_extraction(
    document_ids: List[int],
    selected_pages: int,
    target_pages: int,
    params: schemas.GenerateExtraction,
    username: str,
    db: Session,
):
    if not document_ids:
        raise EmptyExtraction

    return create(
        db,
        GeneratedExtraction(
            document_ids=document_ids,
            selected_pages=selected_pages,
            target_pages=target_pages,
            include_categories=params.include_categories,
            location_ids=params.location_ids,
            target_pages_threshold=params.target_pages_threshold,
            whole_categories_threshold=params.whole_categories_threshold,
            generated_by=username,
        ),
    )


def get_extractable_documents(
    category_id: int, location_patterns: List[str], db: Session
):
    query = (
        db.query(Document)
        .filter(Document.category_id == category_id)
        .filter(
            or_(
                and_(
                    Document.pages_count.is_not(None), Document.pages_count > 0
                ),
                and_(
                    Document.pages_count_manual.is_not(None),
                    Document.pages_count_manual > 0,
                ),
                and_(
                    Document.pages_count_predicted.is_not(None),
                    Document.pages_count_predicted > 0,
                ),
            )
        )
        .filter(Document.cnb.is_not(None))
        .filter(Document.extraction_id.is_(None))
    )

    if location_patterns:
        regex_filters = [
            Document.signature.op("~")(pattern)
            for pattern in location_patterns
        ]
        query = query.filter(or_(*regex_filters))

    return query.all()


def get_extraction_documents(
    extraction_id: int, db: Session, category_id: Optional[int] = None
) -> List[Document]:
    query_base = db.query(Document).join(
        GeneratedExtraction,
        and_(
            GeneratedExtraction.id == extraction_id,
            GeneratedExtraction.document_ids.any(Document.id),
        ),
    )
    if category_id:
        query_base = query_base.filter(Document.category_id == category_id)
    return query_base.all()


def delete_extraction(extraction_id: int, db: Session) -> GeneratedExtraction:
    db_extraction = get_extraction(extraction_id, db)
    db.delete(db_extraction)
    db.commit()
    return db_extraction


def get_extraction(extraction_id: int, db: Session) -> GeneratedExtraction:
    return (
        db.query(GeneratedExtraction)
        .filter(GeneratedExtraction.id == extraction_id)
        .first()
    )


def get_extractions(
    db: Session, offset: int = 0, limit: int = 50
) -> List[GeneratedExtraction]:
    return (
        db.query(GeneratedExtraction)
        .order_by(desc(GeneratedExtraction.id))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_extractions_num_found(db: Session) -> int:
    return db.query(GeneratedExtraction).count()
