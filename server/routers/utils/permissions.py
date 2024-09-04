from datatypes import ActionType
from schemas import CurrentUser
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from models import CategoryDepartments, Document, User
from typing import Callable, List, Union
from .dependencies import DependsOnCurrentUser
from .access_emulation import can_emulate_access
from exceptions import PermissionDeniedException


class OwnershipValidator:
    def EnforceDocumentRead(
        current_user: CurrentUser,
        document_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.ReadDatatableAll in current_user.actions:
            return

        document = Document.get(session, document_id)

        if ActionType.ReadDatatableDepartment in current_user.actions and (
            current_user.username == document.added_by
            or current_user.department_id
            == User.get(session, document.added_by).department.id
        ):
            return

        if (
            ActionType.ReadDatatableOwn in current_user.actions
            and current_user.username == document.added_by
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

        document = Document.get(session, document_id)

        if ActionType.EditDatatableDepartment in current_user.actions and (
            current_user.username == document.added_by
            or current_user.department_id
            == User.get(session, document.added_by).department.id
        ):
            return

        if (
            ActionType.EditDatatableOwn in current_user.actions
            and current_user.username == document.added_by
        ):
            return

        raise exception

    def EnforceCategoryRead(
        current_user: CurrentUser,
        category_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.ReadCategoriesAll in current_user.actions:
            return

        if (
            ActionType.ReadCategoriesDepartment in current_user.actions
            and CategoryDepartments.find(
                category_id, current_user.department_id, session
            )
            is not None
        ):
            return

        raise exception

    def EnforceCategoryEdit(
        current_user: CurrentUser,
        category_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.EditCategoriesAll in current_user.actions:
            return

        if (
            ActionType.EditCategoriesDepartment in current_user.actions
            and CategoryDepartments.find(
                session, category_id, current_user.department_id
            )
            is not None
        ):
            return

        raise exception


class Permission:
    def __init__(
        self,
        action: ActionType,
    ):
        self.action = action

    def has_permission(self, user: CurrentUser):
        return self.action in user.actions


class OwnershipPermission(Permission):
    def __init__(
        self,
        action: ActionType,
        depends: Callable,
    ):
        super().__init__(action)
        self.depends = depends

    def has_permission(self, user: CurrentUser):
        return self.action in user.actions and self.depends(user)


def PermissionValidator(
    permission: Union[
        ActionType, List[Union[ActionType, OwnershipPermission]]
    ],
    exception: HTTPException = PermissionDeniedException,
):
    def permission_validator(
        current_user: CurrentUser = DependsOnCurrentUser,
    ):
        permissions_list = [
            Permission(p) if isinstance(p, ActionType) else p
            for p in (
                permission if isinstance(permission, list) else [permission]
            )
        ]

        if not any(
            permission.has_permission(current_user)
            for permission in permissions_list
        ):
            raise exception

    return Depends(permission_validator)


# class OwnershipValidator:
#     def EnforceCategoryRead(
#         current_user: CurrentUser,
#         category_id: int,
#         session: Session,
#         exception: HTTPException = PermissionDeniedException,
#     ):
#         if ActionType.ReadCategoriesAll not in current_user.actions and (
#             ActionType.ReadCategoriesDepartment not in current_user.actions
#             or current_user.department_id
#             not in Category.get(category_id, session).departments
#         ):
#             raise exception

#     def EnforceDepartmentRead(
#         current_user: CurrentUser,
#         department_id: int,
#         exception: HTTPException = PermissionDeniedException,
#     ):
#         if ActionType.ReadCategoriesAll not in current_user.actions and (
#             ActionType.ReadCategoriesDepartment not in current_user.actions
#             or current_user.department_id != department_id
#         ):
#             raise exception

#     def EnforceCategoryEdit(
#         current_user: CurrentUser,
#         category_id: int,
#         session: Session,
#         exception: HTTPException = PermissionDeniedException,
#     ):
#         if ActionType.EditCategoriesAll not in current_user.actions and (
#             ActionType.EditCategoriesDepartment not in current_user.actions
#             or current_user.department_id
#             not in Category.get(category_id, session).departments
#         ):
#             raise exception


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


CanExtract = PermissionValidator(ActionType.Extract)
CanManageExtraction = PermissionValidator(ActionType.Extract)
CanManageDigitizationList = PermissionValidator(ActionType.Extract)
CanManageLocations = PermissionValidator(ActionType.AdminExtractions)
CanPlanTask = PermissionValidator(ActionType.PlanTasks)
CanManageTask = PermissionValidator(ActionType.AdminTasks)
CanManageIntentions = PermissionValidator(ActionType.EditCategoriesAll)
CanReadIntentions = PermissionValidator(
    [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
)
CanReadCatalogRecords = PermissionValidator(ActionType.ReadCatalogRecords)
CanReviewCatalogRecords = PermissionValidator(ActionType.ReviewCatalogRecords)


def can_emulate_access_validator(
    current_user: CurrentUser = DependsOnCurrentUser,
):
    if not can_emulate_access(current_user):
        raise PermissionDeniedException()


CanEmulateAccess = Depends(can_emulate_access_validator)
