from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from security.permissions import PermissionValidator
from security.types import ActionType
from services.database import get_db

from categories.categories.models import Category, Distribution
from categories.categories import schemas


router = APIRouter(prefix="/categories")

CanManageRootCategories = PermissionValidator(ActionType.EditCategoriesAll)
CanManageCategory = PermissionValidator(ActionType.EditCategoriesAll)
CanReadCategories = PermissionValidator(ActionType.ReadCategoriesAll)
CanReadDepartmentCategories = PermissionValidator(ActionType.ReadCategoriesAll)


@router.post(
    "/category",
    dependencies=[CanManageRootCategories],
    response_model=schemas.Category,
)
def create_root_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
):
    # return None
    return Category.create_root_category(category, db)


@router.post(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def create_sub_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return Category.create_sub_category(category_id, category, db)


@router.put(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def update_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return Category.update(category_id, category, db)


@router.put(
    "/distribution",
    dependencies=[CanManageRootCategories],
    response_model=schemas.DistributionList,
)
def update_root_distribution(
    distribution_list: schemas.DistributionList,
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    Distribution.set_distribution_from_list(
        None, intention_id, distribution_list, db
    )


@router.put(
    "/distribution/{intention_id}/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.DistributionList,
)
def update_sub_distribution(
    distribution_list: schemas.DistributionList,
    intention_id: int = Path(...),
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    Distribution.set_distribution_from_list(
        category_id, intention_id, distribution_list, db
    )


@router.delete(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def delete_category_from_intention(
    intention_id: int = Path(...),
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return Distribution.delete_from_intention(intention_id, category_id, db)


@router.delete(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def delete_category(
    category_id: int = Path(...), db: Session = Depends(get_db)
):
    return Category.delete(category_id, db)


def get_categories(
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    db: Session = Depends(get_db),
):
    query = Category.query_all(db)
    if intention_id:
        query = Category.filter_by_intention_id(query, intention_id)
    return Category.get_query_result(query)


@router.get(
    "/{department_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_category(
    department_id: int = Path(...),
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    db: Session = Depends(get_db),
):
    query = Category.filter_by_department_id(
        Category.query_all(db), department_id
    )
    if intention_id:
        query = Category.filter_by_intention_id(query, intention_id)
    return Category.get_query_result(query)
