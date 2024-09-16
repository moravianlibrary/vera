from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from typing import List
from .utils.dependencies import DependsOnDbSession
from .utils.permissions import CanManageAccess
from schemas import (
    DepartmentCreate,
    DepartmentResponse,
)
from models import Department


router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post(
    "",
    dependencies=[CanManageAccess],
    response_model=DepartmentResponse,
)
def create_department(
    department: DepartmentCreate, db: Session = DependsOnDbSession
):
    created_department = department.load_to_model(Department()).save(db)
    created_department.save_users(db, department.usernames)
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
        Department.get(db, department_id)
    ).save(db)
    updated_department.save_users(db, department.usernames)
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
