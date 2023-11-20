from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from services.database import get_db
from . import crud, schemas
from typing import List


router = APIRouter()


@router.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate,
                    db: Session = Depends(get_db)):
    return crud.create_category(category, db)


@router.put("/categories/{id}", response_model=schemas.Category)
def update_category(category: schemas.CategoryCreate,
                    id: int = Path(...),
                    db: Session = Depends(get_db)):
    return crud.update_category(id, category, db)


@router.delete("/categories/{id}", response_model=schemas.Category)
def delete_category(id: int = Path(...),
                    db: Session = Depends(get_db)):
    return crud.delete_category(id, db)


@router.get("/categories", response_model=List[schemas.Category])
def get_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)
