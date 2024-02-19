from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from typing import List

from services.database import get_db
from . import crud, schemas


router = APIRouter()


@router.post("/departments", response_model=schemas.Department)
def create_department(
    department: schemas.DepartmentCreate, db: Session = Depends(get_db)
):
    return crud.create_department(department, db)


@router.put("/departments/{id}", response_model=schemas.Department)
def update_department(
    department: schemas.DepartmentCreate,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.update_department(id, department, db)


@router.delete("/departments/{id}", response_model=schemas.Department)
def delete_department(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_department(id, db)


@router.put("/departments/{id}/user", response_model=schemas.Department)
def add_user_to_department(
    username: str, id: int = Path(...), db: Session = Depends(get_db)
):
    return crud.add_user_to_department(id, username, db)


@router.delete("/departments/{id}/user", response_model=schemas.Department)
def delete_user_from_department(
    username: str, id: int = Path(...), db: Session = Depends(get_db)
):
    return crud.delete_user_from_department(id, username, db)


@router.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)
