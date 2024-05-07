from roles.types import ActionType
from auth.permissions import PermissionValidator


CanExtract = PermissionValidator(ActionType.Extract)
CanManageExtraction = PermissionValidator(ActionType.Extract)
CanManageDigitizationList = PermissionValidator(ActionType.Extract)
CanManageLocations = PermissionValidator(ActionType.AdminExtractions)
