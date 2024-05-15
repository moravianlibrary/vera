from sqlalchemy.orm import Session

from security.api import get_current_user
from security.permissions import PermissionValidator, OwnershipPermission
from documents import crud
from security.crud import get_departments
from security.types import ActionType


def owns_department_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    user = get_current_user(token, db)
    if user.department_id is None:
        return False
    document_creator = crud.get_document(document_id, db).creator
    document_departments = get_departments(document_creator, db)

    return user.department_id in document_departments


def owns_document(
    token: str, document_id: int, db: Session, *args, **kwargs
) -> bool:
    return (
        get_current_user(token, db).username
        == crud.get_document(document_id, db).creator
    )


EditDepartmentDocumentPermission: OwnershipPermission = (
    ActionType.EditDatatableDepartment,
    owns_department_document,
)

EditOwnDocumentPermission: OwnershipPermission = (
    ActionType.EditDatatableOwn,
    owns_document,
)

ReadDepartmentDocumentPermission: OwnershipPermission = (
    ActionType.ReadDatatableDepartment,
    owns_department_document,
)

ReadOwnDocumentPermission: OwnershipPermission = (
    ActionType.ReadDatatableOwn,
    owns_document,
)


CanInsertDocuments = PermissionValidator(ActionType.InsertDatatable)
CanManageDocument = PermissionValidator(
    [
        ActionType.EditDatatableAll,
        EditDepartmentDocumentPermission,
        EditOwnDocumentPermission,
    ]
)
CanReadDocument = PermissionValidator(
    [
        ActionType.ReadDatatableAll,
        ReadDepartmentDocumentPermission,
        ReadOwnDocumentPermission,
    ]
)
CanReadDocuments = PermissionValidator(
    [
        ActionType.ReadDatatableAll,
        ActionType.ReadDatatableDepartment,
        ActionType.ReadDatatableOwn,
    ]
)
CanManageDocuments = PermissionValidator(
    [
        ActionType.EditDatatableAll,
        ActionType.EditDatatableDepartment,
        ActionType.EditDatatableOwn,
    ]
)
