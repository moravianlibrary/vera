from sqlalchemy.orm import Session
from .dependencies import get_current_user
from models import Document, User


def owns_department_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    user = get_current_user(token, db)
    if user.department_id is None:
        return False
    document_creator = Document.get(db, document_id).creator
    document_departments = User.find_by_name(db, document_creator)

    return user.department_id in document_departments


def owns_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    return (
        get_current_user(token, db).username
        == Document.get(db, document_id).creator
    )
