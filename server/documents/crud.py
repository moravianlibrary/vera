from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from services.database import create
from categories.models import Category
from documents import models, schemas
from documents.search import filter_documents_query_base
from extractions.models import Extraction
from services import exceptions


def document_view(db: Session):
    return (
        db.query(
            models.Document.id,
            models.Document.sysno,
            models.Document.volume,
            models.Document.barcode,
            models.Document.category_id,
            Category.name.label("category_name"),
            models.Document.cnb,
            models.Document.isbn_issn,
            models.Document.signature,
            models.Document.material_type,
            models.Document.issuance_type,
            models.Document.title,
            models.Document.digitization_state,
            models.Document.pages_count,
            models.Document.size,
            models.Document.publisher,
            models.Document.publishing_place,
            models.Document.languages,
            models.Document.frequencies,
            models.Document.pages_count_predicted,
            models.Document.dedicated_scanner,
            models.Document.created_at,
            models.Document.creator,
            models.Document.extraction_id,
            Extraction.extractor,
            Extraction.extracted_at,
        )
        .outerjoin(Category, models.Document.category_id == Category.id)
        .outerjoin(Extraction, models.Document.extraction_id == Extraction.id)
    )


def create_document(
    document: schemas.DocumentCreate, creator: str, db: Session
) -> schemas.DocumentView:
    db_document = create(
        db,
        models.Document(
            sysno=document.sysno,
            volume=document.volume,
            barcode=document.barcode,
            category_id=document.category_id,
            cnb=document.cnb,
            isbn_issn=document.isbn_issn,
            signature=document.signature,
            material_type=document.material_type,
            issuance_type=document.issuance_type,
            title=document.title,
            digitization_state=document.digitization_state,
            year=document.year,
            bundle=document.bundle,
            pages_count=document.pages_count,
            size=document.size,
            publisher=document.publisher,
            publishing_place=document.publishing_place,
            publishing_year=document.publishing_year,
            languages=document.languages,
            # frequencies=document.frequencies,
            frequencies=[
                frequency.model_dump() for frequency in document.frequencies
            ],
            creator=creator,
        ),
    )
    return get_document_view(db_document.id, db)


def update_document(
    document_id: int,
    new_document: schemas.DocumentCreate,
    username: str,
    db: Session,
) -> schemas.DocumentView:
    existing_document = get_document(document_id, db)
    if not existing_document:
        raise exceptions.DocumentNotFoundException(document_id)

    for field in new_document.model_dump(exclude_unset=True):
        setattr(existing_document, field, getattr(new_document, field))

    db.commit()

    return get_document_view(document_id, db)


def delete_document(document_id: int, db: Session):
    db_document = get_document(document_id, db)
    if db_document is None:
        raise exceptions.DocumentNotFoundException(id)
    db.delete(db_document)
    db.commit()
    return db_document


def get_document(document_id: int, db: Session):
    document = (
        db.query(models.Document)
        .filter(models.Document.id == document_id)
        .first()
    )
    if document is None:
        raise exceptions.DocumentNotFoundException(id)
    return document


def get_document_view(document_id: int, db: Session):
    return document_view(db).filter(models.Document.id == document_id).first()


def get_document_by_identifiers(
    sysno: str,
    volume: Optional[str],
    barcode: Optional[str],
    db: Session,
):
    query_base = db.query(models.Document).filter(
        models.Document.sysno == sysno
    )
    if volume:
        query_base = query_base.filter(models.Document.volume == volume)
    if barcode:
        query_base = query_base.filter(models.Document.barcode == barcode)
    return query_base.first()


def document_exists(
    sysno: str,
    volume: Optional[str],
    barcode: Optional[str],
    db: Session,
) -> bool:
    return get_document_by_identifiers(sysno, volume, barcode, db) is not None


def get_documents_query_base(
    db: Session, query: Optional[schemas.DocumentsQuery] = None
):
    return filter_documents_query_base(document_view(db), query)


def get_documents_ids_query_base(
    db: Session, query: Optional[schemas.DocumentsQuery] = None
):
    return filter_documents_query_base(db.query(models.Document.id), query)


def get_documents(query_base: Session, offset: int = 0, limit: int = 100):
    return (
        query_base.order_by(desc(models.Document.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_documents_num_found(query_base: Session):
    return query_base.count()
