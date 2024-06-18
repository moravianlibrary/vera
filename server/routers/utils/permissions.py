from security.types import ActionType
from security.schemas import CurrentUser
from security.permissions import PermissionValidator

# from security.permissions import OwnershipPermission
# from routers.utils.ownership import owns_document, owns_department_document
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from crud.documents import get_document
from security.crud import get_user_departments


CanManageAccess = PermissionValidator(ActionType.EditAccess)

CanCreateDocument = PermissionValidator(ActionType.WriteDatatable)
CanInsertDocument = PermissionValidator(ActionType.InsertDatatable)
CanManageDocument = PermissionValidator(
    [
        ActionType.EditDatatableAll,
        ActionType.EditDatatableDepartment,
        ActionType.EditDatatableOwn,
        # OwnershipPermission(
        #     ActionType.EditDatatableDepartment,
        #     owns_department_document,
        # ),
        # OwnershipPermission(
        #     ActionType.EditDatatableOwn,
        #     owns_document,
        # ),
    ]
)
CanReadDocument = PermissionValidator(
    [
        ActionType.ReadDatatableAll,
        ActionType.ReadDatatableDepartment,
        ActionType.ReadDatatableOwn,
        # OwnershipPermission(
        #     ActionType.ReadDatatableDepartment,
        #     owns_department_document,
        # ),
        # OwnershipPermission(
        #     ActionType.ReadDatatableOwn,
        #     owns_document,
        # ),
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


class PermissionDeniedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
            headers={"WWW-Authenticate": "Bearer"},
        )


class OwnershipValidator:
    def EnforceDocumentRead(
        current_user: CurrentUser,
        document_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.ReadDatatableAll in current_user.actions:
            return

        document = get_document(document_id, session)

        if ActionType.ReadDatatableDepartment in current_user.actions and (
            current_user.username == document.creator
            or current_user.department_id
            == [d.id for d in get_user_departments(document.creator, session)]
        ):
            return

        if (
            ActionType.ReadDatatableOwn in current_user.actions
            and current_user.username == document.creator
        ):
            return

        raise exception

    def EnforceDocumentEdit(
        current_user: CurrentUser,
        document_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.EditDatatableAll in current_user.actions:
            return

        document = get_document(document_id, session)

        if ActionType.EditDatatableDepartment in current_user.actions and (
            current_user.username == document.creator
            or current_user.department_id
            == [d.id for d in get_user_departments(document.creator, session)]
        ):
            return

        if (
            ActionType.EditDatatableOwn in current_user.actions
            and current_user.username == document.creator
        ):
            return

        raise exception
