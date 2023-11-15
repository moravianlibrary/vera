from sqlalchemy.orm import Session
from sqlalchemy import desc, func, update
from typing import Optional

from services.database import create
from . import models, schemas
from users import schemas as users_schemas


def create_document(document: schemas.Document,
                    user: users_schemas.User,
                    db: Session):
    db_document = create(db, models.Document(
        sysno=document.sysno,
        volume_number=document.volume_number,
        item_number=document.item_number,
        category_id=document.category_id,
        material_type=document.material_type,
        title=document.title,
        publishers=document.publishers,
        pages_count=document.pages_count,
        size=document.size,
        signature=document.signature,
        barcode=document.barcode,
        ccnb=document.ccnb,
        isbn=document.isbn,
        creator_id=user.id
    ))
    return get_document_view(db_document.id, db)


def update_document(document_id: int,
                    document: schemas.DocumentCreate,
                    user: users_schemas.User,
                    db: Session):
    db_document = get_document(document_id, db)
    if not document:
        return

    db_document.sysno = document.sysno
    db_document.volume_number = document.volume_number
    db_document.item_number = document.item_number
    db_document.category_id = document.category_id
    db_document.material_type = document.material_type
    db_document.title = document.title
    db_document.pages_count = document.pages_count
    db_document.size = document.size
    db_document.barcode = document.barcode
    db_document.signature = document.signature
    db_document.ccnb = document.ccnb
    db_document.isbn = document.isbn

    db.commit()

    return get_document_view(document_id, db)


def delete_document(document_id: int,
                    db: Session):
    db_document = get_document(document_id, db)
    db.delete(db_document)
    db.commit()
    return db_document


def get_document(document_id: int,
                 db: Session):
    return (db.query(models.Document)
            .filter(models.Document.id == document_id)
            .first())


def get_document_view(document_id: int,
                      db: Session):
    return (db.query(models.DocumentView)
            .filter(models.DocumentView.id == document_id)
            .first())


def get_document_by_identifiers(sysno: str,
                                volume_number: Optional[str],
                                item_number: Optional[str],
                                db: Session):
    query_base = (db.query(models.Document)
                  .filter(models.Document.sysno == sysno))
    if volume_number:
        query_base = query_base.filter(
            models.Document.volume_number == volume_number
        )
    if item_number:
        query_base = query_base.filter(
            models.Document.item_number == item_number
        )
    return query_base.first()


def get_documents_query_base(db: Session,
                             sysno: Optional[str] = None,
                             creator_id: Optional[int] = None,
                             creator_department_id: Optional[int] = None,
                             extraction_id: Optional[int] = None,
                             onlyExtracted: bool = False):
    query_base = db.query(models.DocumentView)

    if sysno is not None:
        query_base = query_base.filter(models.DocumentView.sysno == sysno)
    if creator_id is not None:
        query_base = query_base.filter(
            models.DocumentView.creator_id == creator_id
        )
    if creator_department_id is not None:
        query_base = query_base.filter(
            models.DocumentView.creator_department_id == creator_department_id
        )
    if extraction_id is not None:
        query_base = query_base.filter(
            models.DocumentView.extraction_id == extraction_id
        )
    if onlyExtracted:
        query_base = query_base.filter(
            models.DocumentView.extraction_id.isnot(None)
        )

    return query_base


def get_documents(db: Session,
                  query_base: Session,
                  offset: int = 0,
                  limit: int = 100):
    return (query_base.order_by(desc(models.DocumentView.created_at))
            .offset(offset).limit(limit)
            .all())


def get_documents_num_found(db: Session,
                            query_base: Session):
    return query_base.count()


def create_comment(comment: schemas.CommentCreate,
                   document_id: int,
                   user_id: int,
                   db: Session):
    return create(db, models.Comment(
        document_id=document_id,
        user_id=user_id,
        text=comment.text
    ))


def update_comment(comment: schemas.Comment,
                   db: Session):
    (db.execute(update(models.Comment).where(models.Comment.id == comment.id)
                .values(text=comment.text)
                .values(edited_at=func.now())))


def delete_comment(comment_id: int,
                   db: Session):
    db_comment = (db.query(models.Comment)
                  .where(models.Comment.id == comment_id)
                  .first())
    db.delete(db_comment)
    db.commit()
    return db_comment


def get_comment(comment_id: int,
                db: Session):
    return (db.query(models.Comment)
            .filter(models.Comment.id == comment_id)
            .first())


def get_comments_for_document(document_id: int,
                              db: Session):
    return (db.query(models.Comment)
            .filter(models.Comment.Document_id == document_id)
            .all())
