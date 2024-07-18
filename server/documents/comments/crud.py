from sqlalchemy.orm import Session
from sqlalchemy import func, update

from services.database import create
from documents.comments import schemas
from models import Comment


def create_comment(
    comment: schemas.CommentCreate, document_id: int, user_id: int, db: Session
):
    return create(
        db,
        Comment(document_id=document_id, user_id=user_id, text=comment.text),
    )


def update_comment(comment: schemas.Comment, db: Session):
    (
        db.execute(
            update(Comment)
            .where(Comment.id == comment.id)
            .values(text=comment.text)
            .values(edited_at=func.now())
        )
    )


def delete_comment(comment_id: int, db: Session):
    db_comment = db.query(Comment).where(Comment.id == comment_id).first()
    db.delete(db_comment)
    db.commit()
    return db_comment


def get_comment(comment_id: int, db: Session):
    return db.query(Comment).filter(Comment.id == comment_id).first()


def get_comments_for_document(document_id: int, db: Session):
    return db.query(Comment).filter(Comment.Document_id == document_id).all()
