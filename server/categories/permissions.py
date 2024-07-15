# from fastapi import Depends
# from sqlalchemy.orm import Session

# from schemas.security import CurrentUser
# from services.database import get_db
# from categories import crud
# from schemas.types.action_type import ActionType
# from routers.utils.permissions import PermissionValidator, OwnershipPermission


# def get_category_id(category_id: int) -> int:
#     return category_id


# def owns_category(
#     user: CurrentUser,
#     category_id: int = Depends(get_category_id),
#     db: Session = Depends(get_db),
# ) -> bool:
#     return user.department_id in crud.get_category(category_id, db).departments


# EditDepartmentCategoryPermission = OwnershipPermission(
#     ActionType.EditCategoriesDepartment,
#     owns_category,
# )

# ReadDepartmentCategoryPermission = OwnershipPermission(
#     ActionType.ReadCategoriesDepartment,
#     owns_category,
# )


# CanManageRootCategories = PermissionValidator(ActionType.EditCategoriesAll)
# CanManageCategories = PermissionValidator(
#     [ActionType.EditCategoriesAll, EditDepartmentCategoryPermission]
# )
# CanReadCategories = PermissionValidator(
#     [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
# )

# CanReadCategory = PermissionValidator(
#     [ActionType.ReadCategoriesAll, ReadDepartmentCategoryPermission]
# )
