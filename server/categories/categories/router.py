from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from security.permissions import OwnershipValidator, PermissionValidator
from security.types import ActionType
from services.database import get_db
from security.api import get_current_user

from categories.categories.models import (
    Category,
    CategoryDepartments,
    Distribution,
)
from categories.categories import schemas
from categories.categories.mappers import (
    map_to_category_distribution,
    map_to_category_extraction,
)
from extractions.generated.models import GeneratedExtraction
from security.schemas import CurrentUser


router = APIRouter(prefix="/categories")


def owns_category(
    token: str, category_id: int, db: Session, *args, **kwargs
) -> bool:
    return (
        CategoryDepartments.find(
            category_id, get_current_user(token, db).department_id, db
        )
        is not None
    )


CanManageRootCategories = PermissionValidator(ActionType.EditCategoriesAll)
CanManageCategory = PermissionValidator(
    [
        ActionType.EditCategoriesAll,
        ActionType.EditCategoriesDepartment,
    ]
)
CanReadCategories = PermissionValidator(ActionType.ReadCategoriesAll)
CanReadDepartmentCategories = PermissionValidator(
    [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
)


@router.post(
    "/root",
    dependencies=[CanManageRootCategories],
    response_model=schemas.Category,
)
def create_root_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
):
    return Category.create_root_category(category, db)


@router.post(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def create_sub_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator(
        CategoryDepartments.find(category_id, current_user.department_id, db)
    )
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
    "/root/distribution",
    dependencies=[CanManageRootCategories],
    response_model=schemas.Distributions,
)
def update_root_distribution(
    distribution_list: schemas.DistributionList,
    db: Session = Depends(get_db),
):
    return Distribution.set_distribution_from_list(
        None,
        distribution_list.intention_id,
        distribution_list.distributions,
        db,
    )


@router.put(
    "/{category_id}/distribution",
    dependencies=[CanManageCategory],
    response_model=schemas.Distributions,
)
def update_sub_distribution(
    distribution_list: schemas.DistributionList,
    category_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return Distribution.set_distribution_from_list(
        category_id,
        distribution_list.intention_id,
        distribution_list.distributions,
        db,
    )


@router.delete(
    "/{category_id}/intentions/{intention_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Distributions,
)
def delete_category_from_intention(
    category_id: int = Path(...),
    intention_id: int = Path(...),
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


@router.get(
    "",
    dependencies=[CanReadCategories],
    response_model=schemas.Categories,
)
def get_categories(
    db: Session = Depends(get_db),
):
    return db.query(Category).filter_by(parent_id=None).all()


@router.get(
    "/intentions/{intention_id}",
    dependencies=[CanReadCategories],
    response_model=schemas.CategoryDistributions,
)
def get_categories_by_intention(
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return [
        map_to_category_distribution(category, distribution, intention_id)
        for category, distribution in Category.get_intention_categories(
            intention_id, db
        )
    ]


@router.get(
    "/intentions/{intention_id}/extractions/{extraction_id}",
    dependencies=[CanReadCategories],
    response_model=schemas.CategoryDistributions,
)
def get_categories_by_extraction(
    intention_id: int = Path(...),
    extraction_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return [
        map_to_category_extraction(
            category,
            distribution,
            intention_id,
            GeneratedExtraction.get_extraction(extraction_id, db).document_ids,
        )
        for category, distribution in Category.get_intention_categories(
            intention_id, extraction_id, db
        )
    ]


@router.get(
    "/departments/{department_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_department_categories(
    department_id: int = Path(...),
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    db: Session = Depends(get_db),
):
    query = Category.query_by_department(department_id, db)
    if intention_id:
        query = Category.filter_by_intention_id(query, intention_id)
    return Category.get_query_result(query)
