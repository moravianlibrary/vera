from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from typing import List
from .utils import access_emulation
from .utils import permissions
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession
from .utils.permissions import CanManageAccess
from datatypes import ActionType, JsonBase
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


router = APIRouter(prefix="/departments")


@router.post(
    "",
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
    "/{department_id}",
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
    "/{department_id}",
    dependencies=[CanManageAccess],
    response_model=DepartmentResponse,
)
def delete_department(
    department_id: int = Path(...), db: Session = DependsOnDbSession
):
    return Department.get(db, department_id).delete(db)


@router.get(
    "",
    dependencies=[CanManageAccess],
    response_model=List[DepartmentResponse],
)
def get_departments(db: Session = DependsOnDbSession):
    return Department.all(db)
