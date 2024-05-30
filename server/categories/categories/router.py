from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from security.permissions import (
    OwnershipValidator,
    PermissionValidator,
)
from security.types import ActionType
from services.database import get_db
from security.api import get_current_user

from categories.categories.models import (
    Category,
    Distribution,
)
from categories.categories import schemas
from categories.categories.mappers import (
    map_to_category_distribution,
    map_to_category_extraction,
    map_to_category_digitization,
)
from extractions.generated.models import GeneratedExtraction
from extractions.digitization.models import DigitizationExtraction
from security.schemas import CurrentUser


router = APIRouter(prefix="/categories")


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
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return Category.create_sub_category(category_id, category, db)


@router.put(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def update_category(
    category: schemas.CategoryCreate,
    category_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return Category.update(category_id, category, db)


@router.put(
    "/root/distribution",
    dependencies=[CanManageRootCategories],
    response_model=schemas.Categories,
)
def update_root_distribution(
    distribution_list: schemas.DistributionList,
    db: Session = Depends(get_db),
):
    return [
        map_to_category_distribution(distribution.category, distribution)
        for distribution in Distribution.set_distribution_from_list(
            None,
            distribution_list.intention_id,
            distribution_list.distributions,
            db,
        )
    ]


@router.put(
    "/{category_id}/distribution",
    dependencies=[CanManageCategory],
    response_model=schemas.Categories,
)
def update_sub_distribution(
    distribution_list: schemas.DistributionList,
    category_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return [
        map_to_category_distribution(distribution.category, distribution)
        for distribution in Distribution.set_distribution_from_list(
            category_id,
            distribution_list.intention_id,
            distribution_list.distributions,
            db,
        )
    ]


@router.delete(
    "/{category_id}/in_intention/{intention_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Distributions,
)
def delete_category_from_intention(
    category_id: int = Path(...),
    intention_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return Distribution.delete_from_intention(intention_id, category_id, db)


@router.delete(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=schemas.Category,
)
def delete_category(
    category_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
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
    "/in_intention/{intention_id}",
    dependencies=[CanReadCategories],
    response_model=schemas.Categories,
)
def get_categories_by_intention(
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return [
        map_to_category_distribution(category, distribution)
        for category, distribution in Category.get_intention_categories(
            intention_id, db
        )
    ]


@router.get(
    "/in_intention/{intention_id}/by_extraction/{extraction_id}",
    dependencies=[CanReadCategories],
    response_model=schemas.Categories,
)
def get_categories_by_extraction(
    intention_id: int = Path(...),
    extraction_id: int = Path(...),
    db: Session = Depends(get_db),
):
    extraction = GeneratedExtraction.get_extraction(extraction_id, db)
    return [
        map_to_category_extraction(
            category,
            distribution,
            extraction,
        )
        for category, distribution in Category.get_intention_categories(
            intention_id, db
        )
    ]


@router.get(
    "/in_intention/{intention_id}/by_digitizations",
    dependencies=[CanReadCategories],
    response_model=schemas.Categories,
)
def get_categories_by_digitization(
    intention_id: int = Path(...),
    digitization_ids: Optional[List[int]] = Query(
        None, description="Digitization ID"
    ),
    db: Session = Depends(get_db),
):
    if not digitization_ids:
        digitization_ids = [
            digitization.id
            for digitization in DigitizationExtraction.get_by_intention(
                intention_id, db
            )
        ]
    return [
        map_to_category_digitization(
            category,
            distribution,
            digitization_ids,
        )
        for category, distribution in Category.get_intention_categories(
            intention_id, db
        )
    ]


@router.get(
    "/departments/{department_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_department_categories(
    department_id: int = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OwnershipValidator.EnforceCategoryRead(current_user, department_id, db)
    return Category.get_department_categories(department_id, db)


@router.get(
    "/departments/{department_id}/in_intention/{intention_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_department_categories_by_intention(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return [
        map_to_category_distribution(category, distribution)
        for category, distribution in (
            Category.get_department_intention_categories(
                department_id, intention_id, db
            )
        )
    ]


@router.get(
    "/departments/{department_id}"
    "/in_intention/{intention_id}/by_extraction/{extraction_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_department_categories_by_extraction(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    extraction_id: int = Path(...),
    db: Session = Depends(get_db),
):
    extraction = GeneratedExtraction.get_extraction(extraction_id, db)
    return [
        map_to_category_extraction(
            category,
            distribution,
            extraction,
        )
        for category, distribution in (
            Category.get_department_intention_categories(
                department_id, intention_id, db
            )
        )
    ]


@router.get(
    "/departments/{department_id}"
    "/in_intention/{intention_id}/by_digitizations",
    dependencies=[CanReadDepartmentCategories],
    response_model=schemas.Categories,
)
def get_department_categories_by_digitization(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    digitization_ids: Optional[List[int]] = Query(
        None, description="Digitization ID"
    ),
    db: Session = Depends(get_db),
):
    if not digitization_ids:
        digitization_ids = [
            digitization.id
            for digitization in DigitizationExtraction.get_by_intention(
                intention_id, db
            )
        ]
    return [
        map_to_category_digitization(
            category,
            distribution,
            digitization_ids,
        )
        for category, distribution in (
            Category.get_department_intention_categories(
                department_id, intention_id, db
            )
        )
    ]
