from security.types import ActionType
from security.permissions import PermissionValidator


CanManageIntentions = PermissionValidator(ActionType.EditCategoriesAll)
CanReadIntentions = PermissionValidator(
    [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
)
