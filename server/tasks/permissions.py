from roles.types import ActionType
from auth.permissions import PermissionValidator


CanPlanTask = PermissionValidator(ActionType.PlanTasks)
CanManageTask = PermissionValidator(ActionType.AdminTasks)
