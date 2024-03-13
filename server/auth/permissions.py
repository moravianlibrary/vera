from fastapi import Depends

from auth.permissions_validator import (
    CategoryAccessValidator,
    PermissionsValidator,
)
from roles.types import ActionType


EditAccessPermission = [Depends(PermissionsValidator([ActionType.EditAccess]))]

CreateCategoryPermission = [
    Depends(
        CategoryAccessValidator()
        .with_access_permissions([ActionType.EditCategoriesDepartment])
        .with_override_permissions([ActionType.EditCategoriesAll])
    )
]
