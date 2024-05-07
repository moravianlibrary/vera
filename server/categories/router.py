from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List

from auth.schemas import CurrentUser
from roles.types import ActionType
from services.database import get_db
from categories import schemas
from categories import facade
from categories.permissions import (
    CanManageCategories,
    CanManageRootCategories,
    CanReadCategories,
    CanReadCategory,
)
from auth.facade import get_current_user


router = APIRouter(prefix="/categories")


@router.post(
    "/category",
    dependencies=[CanManageRootCategories],
    response_model=schemas.Category,
)
def create_root_category(
    category: schemas.CategoryCreate, db: Session = Depends(get_db)
):
    return facade.create_root_category(category, db)


@router.post(
    "/category/{category_id}",
    dependencies=[CanManageCategories],
    response_model=schemas.Category,
)
def create_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return facade.create_category(category, category_id, db)


@router.put(
    "/category/{category_id}",
    dependencies=[CanManageCategories],
    response_model=schemas.Category,
)
def update_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return facade.update_category(category, category_id, db)


@router.put(
    "/distribution",
    dependencies=[CanManageRootCategories],
    response_model=None,
)
def update_root_distribution(
    distribution: List[schemas.CategoryPercentage],
    db: Session = Depends(get_db),
):
    return facade.update_distribution(distribution, db)


@router.put(
    "/distribution/{category_id}",
    dependencies=[CanManageCategories],
    response_model=None,
)
def update_distribution(
    distribution: List[schemas.CategoryPercentage],
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return facade.update_distribution(distribution, db, category_id)


@router.delete(
    "/category/{category_id}",
    dependencies=[CanManageCategories],
    response_model=schemas.Category,
)
def delete_category(
    category_id: int = Path(...), db: Session = Depends(get_db)
):
    return facade.delete_category(category_id, db)


@router.get(
    "",
    dependencies=[CanReadCategories],
    response_model=List[schemas.CategoryNode],
)
def get_categories(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadCategoriesAll in user.actions:
        return facade.get_root_categories(db)
    return facade.get_department_categories(user.department_id, db)


@router.get(
    "/descriptors",
    dependencies=[CanReadCategories],
    response_model=List[schemas.CategoryDescriptor],
)
def get_categories_descriptors(
    assignable: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadCategoriesAll in user.actions:
        return facade.get_root_categories_descriptors(db, assignable)
    return facade.get_department_categories_descriptors(
        user.department_id, db, assignable
    )


@router.get(
    "/descriptors/{category_id}",
    dependencies=[CanReadCategory],
    response_model=schemas.CategoryDescriptor,
)
def get_category_descriptor(
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return facade.get_category_descriptor(category_id, db)
