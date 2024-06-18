from sqlalchemy.orm import Session, Query, joinedload
from sqlalchemy import desc
from typing import List, Optional

from services.database import create
import models.documents as models
import schemas.documents as schemas
import schemas.documents_query as query_schemas
from providers.documents_search import filter_documents_query_base
from services import exceptions


EDITABLE_FIELDS = [
    "pages_count_manual",
]


def create_document(
    document: schemas.DocumentCreate, creator: str, db: Session
) -> schemas.Document:
    if document_exists(document.sysno, document.volume, document.barcode, db):
        raise exceptions.UniqueDocumentViolationException(
            document.sysno, document.volume, document.barcode
        )

    return create(
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
            pages_count_catalog=document.pages_count_catalog,
            pages_count_manual=document.pages_count_manual,
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


def update_document(
    document_id: int,
    new_document: schemas.DocumentCreate,
    can_edit_all_fields: bool,
    db: Session,
) -> schemas.Document:
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

    return existing_document


def delete_document(document_id: int, db: Session):
    db_document = get_document(document_id, db)
    if db_document is None:
        raise exceptions.DocumentNotFoundException(id)
    for task_document in db_document.task_documents:
        # task_document.deleted = True
        db.delete(task_document)
    db.delete(db_document)
    db.commit()
    return db_document


def get_document(document_id: int, db: Session):
    document = (
        db.query(models.Document)
        .options(joinedload(models.Document.category))
        .filter(models.Document.id == document_id)
        .first()
    )
    if document is None:
        raise exceptions.DocumentNotFoundException(id)
    return document


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
    db: Session, query: Optional[query_schemas.DocumentsQuery] = None
):
    return filter_documents_query_base(db.query(models.Document), query)


def get_documents_ids_query_base(
    db: Session, query: Optional[query_schemas.DocumentsQuery] = None
):
    return filter_documents_query_base(db.query(models.Document.id), query)


def get_documents(
    query_base: Query, offset: int = 0, limit: int = 100
) -> List[schemas.Document]:
    return (
        query_base.order_by(desc(models.Document.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_documents_num_found(query_base: Query):
    return query_base.count()


def update_documents(query_base: Query, field_name: str, value, db: Session):
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
