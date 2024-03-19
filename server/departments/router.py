from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from typing import List

from auth.permissions import EditAccessPermission
from services.database import get_db
from departments import crud, schemas


router = APIRouter(prefix="/departments")


@router.post(
    "",
    dependencies=EditAccessPermission,
    response_model=schemas.Department,
)
def create_department(
    department: schemas.DepartmentCreate, db: Session = Depends(get_db)
):
    return crud.create_department(department, db)


@router.put(
    "/{department_id}",
    dependencies=EditAccessPermission,
    response_model=schemas.Department,
)
def update_department(
    department: schemas.DepartmentCreate,
    department_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.update_department(department_id, department, db)


@router.delete(
    "/{department_id}",
    dependencies=EditAccessPermission,
    response_model=schemas.Department,
)
def delete_department(
    department_id: int = Path(...), db: Session = Depends(get_db)
):
    return crud.delete_department(department_id, db)


@router.get(
    "",
    dependencies=EditAccessPermission,
    response_model=List[schemas.Department],
)
def get_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)
