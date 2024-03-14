from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.permissions import (
    CreateCategoryPermission,
    DeleteCategoryPermission,
    EditCategoryDistributionPermission,
    ReadCategoriesPermission,
    ReadCategoryPermission,
    UpdateCategoryPermission,
)
from auth.schemas import CurrentUser
from roles.types import ActionType
from services.database import get_db
from services.exceptions import (
    MissingArgumentException,
    WrongInputException,
    CategoryIsNotEmptyException,
    UniqueCategoryNameViolationException,
)
from categories import crud, schemas
from categories.routines import (
    generate_category_descriptor,
    get_category_subtree,
    get_assignable_categories,
    get_department_assignable_categories,
    has_unique_name,
)
from typing import List, Optional


router = APIRouter(prefix="/categories")


@router.post(
    "/category",
    dependencies=CreateCategoryPermission,
    response_model=schemas.Category,
)
def create_category(
    category: schemas.CategoryCreate, db: Session = Depends(get_db)
):
    if not has_unique_name(category, None, db):
        raise UniqueCategoryNameViolationException
    new_category = (
        crud.create_root_category(category, db)
        if category.parent_id is None
        else crud.create_category(category, db)
    )
    return get_category_subtree(new_category, db)


@router.put(
    "/category/{category_id}",
    dependencies=UpdateCategoryPermission,
    response_model=schemas.Category,
)
def update_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    if not has_unique_name(category, category_id, db):
        raise UniqueCategoryNameViolationException
    parent_id = crud.get_category(category_id, db).parent_id
    if category.parent_id is None and parent_id is not None:
        raise Exception("Not implemented change from child to root category")
    elif category.parent_id is not None and parent_id is None:
        raise Exception("Not implemented change from root to child category")
    return crud.update_category(category_id, category, db)


@router.put(
    "/distribution",
    dependencies=EditCategoryDistributionPermission,
    response_model=None,
)
def update_distribution(
    distribution: List[schemas.CategoryPercentage],
    parent_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    categories_ids = [
        category.id for category in crud.get_enabled_for_parent(parent_id, db)
    ]

    if sorted([item.id for item in distribution]) != categories_ids:
        raise MissingArgumentException(
            "Percentage distribution does not contains "
            "all children from one parent"
        )
    if (
        sum([item.percentage for item in distribution]) != 100.0
        and sum([item.percentage for item in distribution]) != 0.0
    ):
        raise WrongInputException(
            "Percentage of all categories on one level has to sum to 100."
        )
    crud.update_distribution(distribution, db)


@router.delete(
    "/category/{category_id}",
    dependencies=DeleteCategoryPermission,
    response_model=schemas.Category,
)
def delete_category(
    category_id: int = Path(...), db: Session = Depends(get_db)
):
    db_category = crud.get_category(category_id, db)
    if db_category.percentage != 0:
        raise CategoryIsNotEmptyException()
    return crud.delete_category(category_id, db)


@router.get(
    "",
    dependencies=ReadCategoriesPermission,
    response_model=List[schemas.CategoryNode],
)
def get_categories(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadCategoriesAll in user.actions:
        return [
            get_category_subtree(root_category, db)
            for root_category in crud.get_root_categories(db)
        ]
    elif user.department_id is not None:
        return [
            get_category_subtree(root_category, db)
            for root_category in crud.get_department_root_categories(
                user.department_id, db
            )
        ]
    return []


@router.get(
    "/descriptors",
    dependencies=ReadCategoriesPermission,
    response_model=List[schemas.CategoryDescriptor],
)
def get_categories_descriptors(
    root: bool = Query(False),
    assignable: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadCategoriesAll in user.actions:
        if root:
            return [
                generate_category_descriptor(category.id, db)
                for category in crud.get_root_categories(db)
            ]
        elif assignable:
            return get_assignable_categories(db)
    elif user.department_id is not None:
        if root:
            return [
                generate_category_descriptor(category.id, db)
                for category in crud.get_department_root_categories(
                    user.department_id, db
                )
            ]
        elif assignable:
            return get_department_assignable_categories(db)
    return []


@router.get(
    "/descriptors/{category_id}",
    dependencies=ReadCategoryPermission,
    response_model=schemas.CategoryDescriptor,
)
def get_category_descriptor(
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return generate_category_descriptor(category_id, db)
