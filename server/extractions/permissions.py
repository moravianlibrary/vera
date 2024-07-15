from schemas.types.action_type import ActionType
from routers.utils.permissions import PermissionValidator


CanExtract = PermissionValidator(ActionType.Extract)
CanManageExtraction = PermissionValidator(ActionType.Extract)
CanManageDigitizationList = PermissionValidator(ActionType.Extract)
CanManageLocations = PermissionValidator(ActionType.AdminExtractions)
