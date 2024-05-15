from sqlalchemy.orm import Session

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


def create_root_category(
    category: schemas.CategoryCreate, db: Session
) -> schemas.CategoryNode:
    if not has_unique_name(category, None, db):
        raise UniqueCategoryNameViolationException
    new_category = crud.create_root_category(category, db)
    return get_category_subtree(new_category, db)


def create_category(
    category: schemas.CategoryCreate,
    parent_category_id: int,
    db: Session,
) -> schemas.CategoryNode:
    if not has_unique_name(category, parent_category_id, db):
        raise UniqueCategoryNameViolationException
    new_category = crud.create_category(category, parent_category_id, db)
    return get_category_subtree(new_category, db)


def update_category(
    category: schemas.CategoryCreate, category_id: int, db: Session
):
    parent_id = crud.get_category(category_id, db).parent_id
    if not has_unique_name(category, parent_id, db, category_id):
        raise UniqueCategoryNameViolationException
    # if category.parent_id is None and parent_id is not None:
    #     raise Exception("Not implemented change from child to root category")
    # elif category.parent_id is not None and parent_id is None:
    #     raise Exception("Not implemented change from root to child category")
    return crud.update_category(category_id, category, db)


def update_distribution(
    distribution: List[schemas.CategoryPercentage],
    db: Session,
    parent_id: Optional[int] = None,
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


def delete_category(category_id: int, db: Session):
    db_category = crud.get_category(category_id, db)
    if db_category.percentage != 0:
        raise CategoryIsNotEmptyException()
    return crud.delete_category(category_id, db)


def get_root_categories(
    db: Session,
):
    return [
        get_category_subtree(root_category, db)
        for root_category in crud.get_root_categories(db)
    ]


def get_department_categories(
    department_id: Optional[int],
    db: Session,
):
    if department_id is None:
        return []
    return [
        get_category_subtree(root_category, db)
        for root_category in crud.get_department_root_categories(
            department_id, db
        )
    ]


def get_root_categories_descriptors(
    db: Session,
    assignable: bool = False,
):
    if assignable:
        return get_assignable_categories(db)
    return [
        generate_category_descriptor(category.id, db)
        for category in crud.get_root_categories(db)
    ]


def get_department_categories_descriptors(
    department_id: Optional[int],
    db: Session,
    assignable: bool = False,
):
    if department_id is None:
        return []
    if assignable:
        return get_department_assignable_categories(department_id, db)
    return [
        generate_category_descriptor(category.id, db)
        for category in crud.get_department_root_categories(department_id, db)
    ]


def get_category_descriptor(
    category_id: int,
    db: Session,
):
    return generate_category_descriptor(category_id, db)
