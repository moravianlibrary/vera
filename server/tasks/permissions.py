from security.types import ActionType
from security.permissions import PermissionValidator


CanPlanTask = PermissionValidator(ActionType.PlanTasks)
CanManageTask = PermissionValidator(ActionType.AdminTasks)
