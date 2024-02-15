from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from services.database import create
from documents import models, schemas
from documents.search import filter_documents_query_base


def create_document(
    document: schemas.DocumentCreate, creator: str, db: Session
):
    db_document = create(
        db,
        models.Document(
            sysno=document.sysno,
            volume_number=document.volume_number,
            category_id=document.category_id,
            signature=document.signature,
            barcode=document.barcode,
            ccnb=document.ccnb,
            isbn=document.isbn,
            material_type=document.material_type,
            title=document.title,
            pages_count=document.pages_count,
            size=document.size,
            digitization_state=document.digitization_state,
            publishers=document.publishers,
            publishing_places=document.publishing_places,
            languages=document.languages,
            frequencies=document.frequencies,
            creator=creator,
        ),
    )
    return get_document_view(db_document.id, db)


def update_document(
    document_id: int,
    document: schemas.DocumentCreate,
    username: str,
    db: Session,
):
    db_document = get_document(document_id, db)
    if not document:
        return

    db_document.sysno = document.sysno
    db_document.volume_number = document.volume_number

    db_document.category_id = document.category_id

    db_document.barcode = document.barcode
    db_document.signature = document.signature
    db_document.ccnb = document.ccnb
    db_document.isbn = document.isbn

    db_document.material_type = document.material_type
    db_document.title = document.title

    db_document.pages_count = document.pages_count
    db_document.size = document.size

    db_document.publishers = document.publishers
    db_document.publishing_places = document.publishing_places
    db_document.languages = document.languages
    db_document.frequencies = document.frequencies

    db.commit()

    return get_document_view(document_id, db)


def delete_document(document_id: int, db: Session):
    db_document = get_document(document_id, db)
    db.delete(db_document)
    db.commit()
    return db_document


def get_document(document_id: int, db: Session):
    return (
        db.query(models.Document)
        .filter(models.Document.id == document_id)
        .first()
    )


def get_document_view(document_id: int, db: Session):
    return (
        models.document_view(db)
        .filter(models.Document.id == document_id)
        .first()
    )


def document_exists(
    sysno: str,
    volume: Optional[str],
    barcode: Optional[str],
    db: Session,
) -> bool:
    return get_document_by_identifiers(sysno, volume, barcode, db) is not None


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


def get_documents_query_base(
    db: Session, query: Optional[schemas.DocumentsQuery] = None
):
    return filter_documents_query_base(models.document_view(db), query)


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
