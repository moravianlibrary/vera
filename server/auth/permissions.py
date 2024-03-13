from fastapi import Depends

from auth.permissions_validator import (
    has_category_department_access,
    PermissionsValidator,
)
from roles.types import ActionType


EditAccessPermission = [Depends(PermissionsValidator([ActionType.EditAccess]))]

CreateCategoryPermission = [
    Depends(
        PermissionsValidator([ActionType.EditCategoriesAll]).or_(
            PermissionsValidator([ActionType.EditCategoriesDepartment]).and_(
                PermissionsValidator(
                    required_function=has_category_department_access
                )
            )
        )
    )
]
