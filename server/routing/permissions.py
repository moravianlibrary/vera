from security.types import ActionType
from security.permissions import PermissionValidator


CanManageAccess = PermissionValidator(ActionType.EditAccess)
