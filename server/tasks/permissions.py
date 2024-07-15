from schemas.types.action_type import ActionType
from routers.utils.permissions import PermissionValidator


CanPlanTask = PermissionValidator(ActionType.PlanTasks)
CanManageTask = PermissionValidator(ActionType.AdminTasks)
