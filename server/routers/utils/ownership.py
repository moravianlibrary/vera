from sqlalchemy.orm import Session
from security.api import get_current_user
import crud.documents as crud_documents
from security.crud import get_departments


def owns_department_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    user = get_current_user(token, db)
    if user.department_id is None:
        return False
    document_creator = crud_documents.get_document(document_id, db).creator
    document_departments = get_departments(document_creator, db)

    return user.department_id in document_departments


def owns_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    return (
        get_current_user(token, db).username
        == crud_documents.get_document(document_id, db).creator
    )
