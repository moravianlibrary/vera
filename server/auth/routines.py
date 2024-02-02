from sqlalchemy.orm import Session

from roles.crud import get_role_by_name, create_role
from roles.schemas import RoleCreate
from roles.enums import ActionType


def init_default_roles(db: Session):
    db_role = get_role_by_name("Admin", db)
    if db_role is None:
        create_role(RoleCreate(
            name="Admin",
            actions=list(ActionType)
        ), db)

    db_role = get_role_by_name("User", db)
    if db_role is None:
        create_role(RoleCreate(
            name="User",
            actions=[
                ActionType.ReadDatatableDepartment,
                ActionType.EditDatatableOwn,
                ActionType.InsertDatatable,
                ActionType.CommentOnDatatable,
                ActionType.ReadCategoriesDepartment,
                ActionType.PlanTasks
            ]
        ), db)

    db_role = get_role_by_name("HeadOfDepartment", db)
    if db_role is None:
        create_role(RoleCreate(
            name="HeadOfDepartment",
            actions=[
                ActionType.ReadDatatableDepartment,
                ActionType.EditDatatableDepartment,
                ActionType.InsertDatatable,
                ActionType.CommentOnDatatable,
                ActionType.ReadCategoriesDepartment,
                ActionType.EditCategoriesDepartment,
                ActionType.PlanTasks
            ]
        ), db)
