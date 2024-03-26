from fastapi import Depends

from auth.permissions_validator import (
    CategoryIdAccessValidator,
    CreateCategoryAccessValidator,
    EditCategoryDistributionAccessValidator,
    PermissionsValidator,
    UpdateCategoryAccessValidator,
)
from roles.types import ActionType


EditAccessPermission = [
    # Depends(PermissionsValidator([ActionType.EditAccess]))
]

CreateCategoryPermission = [
    # Depends(
    #     CreateCategoryAccessValidator()
    #     .with_access_permissions([ActionType.EditCategoriesDepartment])
    #     .with_override_permissions([ActionType.EditCategoriesAll])
    # )
]

UpdateCategoryPermission = [
    # Depends(
    #     UpdateCategoryAccessValidator()
    #     .with_access_permissions([ActionType.EditCategoriesDepartment])
    #     .with_override_permissions([ActionType.EditCategoriesAll])
    # )
]

EditCategoryDistributionPermission = [
    # Depends(
    #     EditCategoryDistributionAccessValidator()
    #     .with_access_permissions([ActionType.EditCategoriesDepartment])
    #     .with_override_permissions([ActionType.EditCategoriesAll])
    # )
]

DeleteCategoryPermission = [
    # Depends(
    #     CategoryIdAccessValidator()
    #     .with_access_permissions([ActionType.EditCategoriesDepartment])
    #     .with_override_permissions([ActionType.EditCategoriesAll])
    # )
]

ReadCategoryPermission = [
    # Depends(
    #     CategoryIdAccessValidator()
    #     .with_access_permissions([ActionType.ReadCategoriesDepartment])
    #     .with_override_permissions([ActionType.ReadCategoriesAll])
    # )
]

ReadCategoriesPermission = [
    # Depends(
    #     PermissionsValidator(
    #         [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
    #     )
    # )
]
