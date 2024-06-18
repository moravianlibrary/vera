from security.types import ActionType
from security.permissions import PermissionValidator
from routers.utils.ownership import owns_document, owns_department_document


CanManageAccess = PermissionValidator(ActionType.EditAccess)

CanCreateDocument = PermissionValidator(ActionType.WriteDatatable)
CanInsertDocument = PermissionValidator(ActionType.InsertDatatable)
CanManageDocument = PermissionValidator(
    [
        ActionType.EditDatatableAll,
        (
            ActionType.EditDatatableDepartment,
            owns_department_document,
        ),
        (
            ActionType.EditDatatableOwn,
            owns_document,
        ),
    ]
)
CanReadDocument = PermissionValidator(
    [
        ActionType.ReadDatatableAll,
        (
            ActionType.ReadDatatableDepartment,
            owns_department_document,
        ),
        (
            ActionType.ReadDatatableOwn,
            owns_document,
        ),
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
