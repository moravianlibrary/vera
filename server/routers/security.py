from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from typing import List
from .utils import access_emulation
from .utils import permissions
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession
from .utils.permissions import CanManageAccess
from datatypes import ActionType
from schemas import (
    CurrentUser,
    ActionList,
    RoleCreate,
    UserResponse,
    RoleResponse,
    DepartmentCreate,
    DepartmentResponse,
)
from models import Role, User, Department

router = APIRouter()


def can_emulate_access(user: CurrentUser):
    return (
        ActionType.EditAccess in user.actions
        or user.username in access_emulation.emulated_users
    )


@router.get("/auth/current_user", response_model=CurrentUser)
def get_current_user(
    user: CurrentUser = DependsOnCurrentUser,
):
    return user


@router.get(
    "/auth/users",
    dependencies=[CanManageAccess],
    response_model=List[UserResponse],
)
def get_users(db: Session = DependsOnDbSession):
    return User.all(db)


@router.post(
    "/auth/users/emulate",
    response_model=CurrentUser,
)
def emulate_access(
    actions: ActionList,
    user: CurrentUser = DependsOnCurrentUser,
):
    if not can_emulate_access(user):
        raise permissions.PermissionDeniedException
    access_emulation.emulate_access(user.username, actions.actions)
    user.actions = actions.actions + [ActionType.StopEmulatingAccess]
    return user


@router.delete(
    "/auth/users/emulate",
    response_model=CurrentUser,
)
def end_emulation(
    user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    if not can_emulate_access(user):
        raise permissions.PermissionDeniedException
    access_emulation.stop_emulating_access(user.username)

    role_actions = []
    role = Role.get(db, user.role_id)
    if role:
        role_actions = [action.action for action in role.role_actions]
    user.actions = role_actions

    return user


@router.post(
    "/roles", dependencies=[CanManageAccess], response_model=RoleResponse
)
def create_role(role: RoleCreate, db: Session = DependsOnDbSession):
    return (
        role.load_to_model(db, Role()).save(db).save_actions(db, role.actions)
    )


@router.put(
    "/roles/{role_id}",
    dependencies=[CanManageAccess],
    response_model=RoleResponse,
)
def update_role(
    role: RoleCreate,
    role_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return (
        role.load_to_model(db, Role.get(db, role_id))
        .save(db)
        .save_actions(db, role.actions)
    )


@router.delete(
    "/roles/{id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def delete_role(id: int = Path(...), db: Session = DependsOnDbSession):
    return Role.get(db, id).delete(db)


@router.get(
    "/roles/{id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def get_role(id: int = Path(...), db: Session = DependsOnDbSession):
    return Role.get(db, id)


@router.get(
    "/roles", dependencies=[CanManageAccess], response_model=List[RoleResponse]
)
def get_roles(db: Session = DependsOnDbSession):
    return Role.all(db)


@router.post(
    "/departments",
    dependencies=[CanManageAccess],
    response_model=DepartmentResponse,
)
def create_department(
    department: DepartmentCreate, db: Session = DependsOnDbSession
):
    created_department = department.load_to_model(Department()).save(db)
    created_department.save_users(db, department.users)
    return created_department


@router.put(
    "/departments/{department_id}",
    dependencies=[CanManageAccess],
    response_model=DepartmentResponse,
)
def update_department(
    department: DepartmentCreate,
    department_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    updated_department = department.load_to_model(
        db, Department.get(db, department_id)
    ).save(db)
    updated_department.save_users(db, department.users)
    return updated_department


@router.delete(
    "/departments/{department_id}",
    dependencies=[CanManageAccess],
    response_model=DepartmentResponse,
)
def delete_department(
    department_id: int = Path(...), db: Session = DependsOnDbSession
):
    return Department.get(db, department_id).delete(db)


@router.get(
    "/departments",
    dependencies=[CanManageAccess],
    response_model=List[DepartmentResponse],
)
def get_departments(db: Session = DependsOnDbSession):
    return Department.all(db)
