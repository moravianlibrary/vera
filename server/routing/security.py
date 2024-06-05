from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from typing import List

from security import api, crud, schemas, permissions
from routing.permissions import CanManageAccess
from security.types import ActionType
from services.database import get_db


router = APIRouter()


def can_emulate_access(user: schemas.CurrentUser):
    return (
        ActionType.EditAccess in user.actions
        or user.username in api.emulated_users
    )


@router.get("/auth/current_user", response_model=schemas.CurrentUser)
def get_current_user(
    user: schemas.CurrentUser = Depends(api.get_current_user),
):
    return user


@router.get(
    "/auth/users",
    dependencies=[CanManageAccess],
    response_model=List[schemas.User],
)
def get_users(db: Session = Depends(get_db)):
    return crud.get_users(db)


@router.post(
    "/auth/users/emulate",
    response_model=schemas.CurrentUser,
)
def emulate_access(
    actions: schemas.ActionList,
    user: schemas.CurrentUser = Depends(api.get_current_user),
):
    if not can_emulate_access(user):
        raise permissions.PermissionDeniedException
    api.emulate_access(user.username, actions.actions)
    user.actions = actions.actions + [ActionType.StopEmulatingAccess]
    return user


@router.delete(
    "/auth/users/emulate",
    response_model=schemas.CurrentUser,
)
def end_emulation(
    user: schemas.CurrentUser = Depends(api.get_current_user),
    db: Session = Depends(get_db),
):
    if not can_emulate_access(user):
        raise permissions.PermissionDeniedException
    api.stop_emulating_access(user.username)

    role_actions = []
    role = crud.get_role(user.role_id, db)
    if role:
        role_actions = [action.action for action in role.role_actions]
    user.actions = role_actions

    return user


@router.post(
    "/roles", dependencies=[CanManageAccess], response_model=schemas.Role
)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return crud.create_role(role, db)


@router.put(
    "/roles/{id}", dependencies=[CanManageAccess], response_model=schemas.Role
)
def update_role(
    role: schemas.RoleCreate,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.update_role(id, role, db)


@router.delete(
    "/roles/{id}", dependencies=[CanManageAccess], response_model=schemas.Role
)
def delete_role(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_role(id, db)


@router.get(
    "/roles/{id}", dependencies=[CanManageAccess], response_model=schemas.Role
)
def get_role(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.get_role(id, db)


@router.get(
    "/roles", dependencies=[CanManageAccess], response_model=List[schemas.Role]
)
def get_roles(db: Session = Depends(get_db)):
    return crud.get_roles(db)


@router.post(
    "/departments",
    dependencies=[CanManageAccess],
    response_model=schemas.Department,
)
def create_department(
    department: schemas.DepartmentCreate, db: Session = Depends(get_db)
):
    return crud.create_department(department, db)


@router.put(
    "/departments/{department_id}",
    dependencies=[CanManageAccess],
    response_model=schemas.Department,
)
def update_department(
    department: schemas.DepartmentCreate,
    department_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.update_department(department_id, department, db)


@router.delete(
    "/departments/{department_id}",
    dependencies=[CanManageAccess],
    response_model=schemas.Department,
)
def delete_department(
    department_id: int = Path(...), db: Session = Depends(get_db)
):
    return crud.delete_department(department_id, db)


@router.get(
    "/departments",
    dependencies=[CanManageAccess],
    response_model=List[schemas.Department],
)
def get_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)
