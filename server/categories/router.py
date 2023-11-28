from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from services.database import get_db
from services.exceptions import MissingArgumentException, WrongInputException
from categories import crud, schemas
from typing import List


router = APIRouter()


@router.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate,
                    db: Session = Depends(get_db)):
    if category.parent_id is None:
        return crud.create_root_category(category, db)
    return crud.create_category(category, db)


@router.put("/categories/{id}", response_model=schemas.Category)
def update_category(category: schemas.CategoryCreate,
                    id: int = Path(...),
                    db: Session = Depends(get_db)):
    db_category = crud.get_category(id, db)
    if category.parent_id is None and db_category.parent_id is None:
        return crud.update_root_category(id, category, db)
    elif category.parent_id is None:
        raise Exception("Not implemented change from child to root category")
    elif db_category.parent_id is None:
        raise Exception("Not implemented change from root to child category")
    return crud.update_category(id, category, db)


@router.put("/categories/{id}", response_model=schemas.Category)
def update_categories_percentage(percentage: List[schemas.CategoryPercentage],
                                 id: int = Path(...),
                                 db: Session = Depends(get_db)):
    db_category = crud.get_category(id, db)
    if ([item.id for item in percentage]
            != crud.get_children_categories(id, db)):
        raise MissingArgumentException(
            "Percentage distribution does not contains all children of "
            f"parent '{db_category.name}'.")
    if sum([item.percentage for item in percentage]) != 100.0:
        raise WrongInputException(
            "Percentage of all categories on one level has to sum to 100.")
    crud.update_percentage(percentage)


@router.delete("/categories/{id}", response_model=schemas.Category)
def delete_category(id: int = Path(...),
                    db: Session = Depends(get_db)):
    db_category = crud.get_category(id, db)
    if db_category.parent_id is None:
        return crud.delete_root_category(id, db)
    return crud.delete_category(id, db)


@router.get("/categories", response_model=List[schemas.CategoryNode])
def get_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)


@router.get("/categories_descriptors",
            response_model=List[schemas.CategoryDescriptor])
def get_categories_descriptors(root_categories: bool = Query(False),
                               assignable_categories: bool = Query(False),
                               db: Session = Depends(get_db)):
    if root_categories:
        return crud.get_root_categories(db)
    elif assignable_categories:
        return crud.get_assignable_categories(db)
