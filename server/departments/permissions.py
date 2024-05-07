from roles.types import ActionType
from auth.permissions import PermissionValidator


CanManageAccess = PermissionValidator(ActionType.EditAccess)
