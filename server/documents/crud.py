from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional

from services.database import create
from categories.models import Category
from documents import models, schemas
from documents.search import filter_documents_query_base
from extractions.digitization.models import DigitizationExtraction
from services import exceptions


EDITABLE_FIELDS = [
    "pages_count_manual",
]


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
            models.Document.year,
            models.Document.bundle,
            models.Document.pages_count,
            models.Document.pages_count_predicted,
            models.Document.pages_count_manual,
            func.coalesce(
                models.Document.pages_count_manual,
                models.Document.pages_count_predicted,
                models.Document.pages_count,
            ).label("pages_count_actual"),
            models.Document.size,
            models.Document.locationUri,
            models.Document.publisher,
            models.Document.publishing_place,
            models.Document.publishing_year,
            models.Document.languages,
            models.Document.frequencies,
            models.Document.dedicated_scanner,
            models.Document.created_at,
            models.Document.creator,
            models.Document.extraction_id,
            DigitizationExtraction.extractor,
            DigitizationExtraction.extracted_at,
        )
        .outerjoin(Category, models.Document.category_id == Category.id)
        .outerjoin(
            DigitizationExtraction,
            models.Document.extraction_id == DigitizationExtraction.id,
        )
    )


def documents_view_to_dict(row):
    return {
        "id": row.id,
        "sysno": row.sysno,
        "volume": row.volume,
        "barcode": row.barcode,
        "category_id": row.category_id,
        "category_name": row.category_name,
        "cnb": row.cnb,
        "isbn_issn": row.isbn_issn,
        "signature": row.signature,
        "material_type": (
            row.material_type.value if row.material_type else None
        ),
        "issuance_type": (
            row.issuance_type.value if row.issuance_type else None
        ),
        "title": row.title,
        "digitization_state": (
            row.digitization_state.value if row.digitization_state else None
        ),
        "year": row.year,
        "bundle": row.bundle,
        "pages_count": row.pages_count,
        "pages_count_predicted": row.pages_count_predicted,
        "pages_count_manual": row.pages_count_manual,
        "size": row.size,
        "locationUri": row.locationUri,
        "publisher": row.publisher,
        "publishing_place": row.publishing_place,
        "publishing_year": row.publishing_year,
        "languages": row.languages,
        "frequencies": row.frequencies,
        "dedicated_scanner": row.dedicated_scanner,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "creator": row.creator,
        "extraction_id": row.extraction_id,
        "extractor": row.extractor,
        "extracted_at": (
            row.extracted_at.isoformat() if row.extracted_at else None
        ),
    }


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
            locationUri=document.locationUri,
            publisher=document.publisher,
            publishing_place=document.publishing_place,
            publishing_year=document.publishing_year,
            languages=document.languages,
            # frequencies=document.frequencies,
            frequencies=(
                [frequency.model_dump() for frequency in document.frequencies]
                if document.frequencies
                else []
            ),
            creator=creator,
        ),
    )
    return get_document_view(db_document.id, db)


def update_document(
    document_id: int,
    new_document: schemas.DocumentCreate,
    can_edit_all_fields: bool,
    db: Session,
) -> schemas.DocumentView:
    existing_document = get_document(document_id, db)
    if not existing_document:
        raise exceptions.DocumentNotFoundException(document_id)

    fields = (
        new_document.model_dump(exclude_unset=True, exclude=["frequencies"])
        if can_edit_all_fields
        else EDITABLE_FIELDS
    )
    for field in fields:
        setattr(existing_document, field, getattr(new_document, field))

    db.commit()

    return get_document_view(document_id, db)


def delete_document(document_id: int, db: Session):
    db_document = get_document(document_id, db)
    if db_document is None:
        raise exceptions.DocumentNotFoundException(id)
    for task_document in db_document.task_documents:
        task_document.deleted = True
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


def get_documents(
    query_base: Session, offset: int = 0, limit: int = 100
) -> List[schemas.Document]:
    return (
        query_base.order_by(desc(models.Document.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_documents_num_found(query_base: Session):
    return query_base.count()


def update_documents(query_base: Session, field_name: str, value, db: Session):
    for document in query_base.all():
        db.query(models.Document).filter(
            models.Document.id == document.id
        ).update({field_name: value})
    db.commit()


def delete_documents(query_base: Session, db: Session):
    for document in query_base.all():
        db.query(models.Document).filter(
            models.Document.id == document.id
        ).delete()
    db.commit()
