from security.types import ActionType
from security.permissions import PermissionValidator


CanExtract = PermissionValidator(ActionType.Extract)
CanManageExtraction = PermissionValidator(ActionType.Extract)
CanManageDigitizationList = PermissionValidator(ActionType.Extract)
CanManageLocations = PermissionValidator(ActionType.AdminExtractions)
