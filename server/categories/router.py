from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from services.database import get_db
from services.exceptions import MissingArgumentException, \
    WrongInputException, CategoryIsNotEmptyException
from categories import crud, schemas
from categories.routines import get_category_subtree
from typing import List, Optional


router = APIRouter()


@router.post("/categories/category", response_model=schemas.CategoryNode)
def create_category(category: schemas.CategoryCreate,
                    db: Session = Depends(get_db)):
    new_category = (crud.create_root_category(category, db)
                    if category.parent_id is None
                    else crud.create_category(category, db))
    return get_category_subtree(new_category, db)


@router.put("/categories/category/{id}", response_model=schemas.CategoryNode)
def update_category(category: schemas.CategoryCreate,
                    id: int = Path(...),
                    db: Session = Depends(get_db)):
    parent_id = crud.get_category(id, db).parent_id
    if category.parent_id is None and parent_id is not None:
        raise Exception("Not implemented change from child to root category")
    elif category.parent_id is not None and parent_id is None:
        raise Exception("Not implemented change from root to child category")
    return crud.update_category(id, category, db)


@router.put("/categories/distribution", response_model=None)
def update_distribution(distribution: List[schemas.CategoryPercentage],
                        parent_id: Optional[int] = Query(None),
                        db: Session = Depends(get_db)):
    categories_ids = [category.id for category
                      in crud.get_enabled_for_parent(parent_id, db)]

    if ([item.id for item in distribution] != categories_ids):
        raise MissingArgumentException(
            "Percentage distribution does not contains "
            "all children from one parent")
    if (sum([item.percentage for item in distribution]) != 100.0
            and sum([item.percentage for item in distribution]) != 0.0):
        raise WrongInputException(
            "Percentage of all categories on one level has to sum to 100.")
    crud.update_distribution(distribution, db)


@router.delete("/categories/category/{id}", response_model=schemas.Category)
def delete_category(id: int = Path(...),
                    db: Session = Depends(get_db)):
    db_category = crud.get_category(id, db)
    if db_category.percentage != 0:
        raise CategoryIsNotEmptyException()
    return crud.delete_category(id, db)


@router.get("/categories", response_model=List[schemas.CategoryNode])
def get_categories(db: Session = Depends(get_db)):
    return [get_category_subtree(root_category, db)
            for root_category in crud.get_root_categories(db)]


@router.get("/categories/descriptors",
            response_model=List[schemas.CategoryDescriptor])
def get_categories_descriptors(root: bool = Query(False),
                               assignable: bool = Query(False),
                               db: Session = Depends(get_db)):
    if root:
        return crud.get_root_categories(db)
    elif assignable:
        return crud.get_assignable_categories(db)
