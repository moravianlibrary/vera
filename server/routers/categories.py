from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from .utils.permissions import (
    OwnershipValidator,
    PermissionValidator,
)
from datatypes import ActionType
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession

from .mappers.categories import (
    map_to_category_distribution,
    map_to_category_extraction,
    map_to_category_digitization,
)
from models import (
    Extraction,
    DigitizationList,
    Category,
    Distribution,
)
from schemas import (
    CurrentUser,
    CategoryCreate,
    CategoryResponse,
    Categories,
    DistributionList,
    DistributionCreate,
)


router = APIRouter(prefix="/categories", tags=["Categories"])


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
    response_model=CategoryResponse,
)
def create_root_category(
    category: CategoryCreate,
    db: Session = DependsOnDbSession,
):
    created_category = category.load_to_model(Category()).save(db)
    created_category.save_departments(db, category.departments)
    return created_category


@router.post(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=CategoryResponse,
)
def create_sub_category(
    category: CategoryCreate,
    category_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    created_category = category.load_to_model(Category(), category_id).save(db)
    created_category.save_departments(db, category.departments)
    return created_category


@router.put(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=CategoryResponse,
)
def update_category(
    category: CategoryCreate,
    category_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return category.load_to_model(Category.get(db, category_id)).save(db)


@router.put(
    "/root/distribution",
    dependencies=[CanManageRootCategories],
    response_model=Categories,
)
def update_root_distribution(
    distribution_list: DistributionList,
    db: Session = DependsOnDbSession,
):
    # TODO: intention_id as parameter
    distribution_list.validate_composition(
        set(category.id for category in Category.get_root_categories(db))
    )
    return [
        map_to_category_distribution(
            distribution.load_to_model(
                Distribution(), distribution_list.intention_id
            )
            .save(db)
            .category,
            distribution_list.intention_id,
        )
        for distribution in distribution_list.distributions
    ]


@router.put(
    "/{category_id}/distribution",
    dependencies=[CanManageCategory],
    response_model=Categories,
)
def update_sub_distribution(
    distribution_list: DistributionList,
    category_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    # TODO: intention_id as parameter
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    distribution_list.validate_composition(
        set(c.id for c in Category.get(db, category_id).sub_categories)
    )
    return [
        map_to_category_distribution(
            (
                distribution.load_to_model(
                    Distribution(), distribution_list.intention_id
                )
            )
            .save(db)
            .category,
            distribution_list.intention_id,
        )
        for distribution in distribution_list.distributions
    ]


@router.delete(
    "/{category_id}/in_intention/{intention_id}",
    dependencies=[CanManageCategory],
    response_model=DistributionCreate,
)
def delete_category_from_intention(
    category_id: int = Path(...),
    intention_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return Distribution.get(db, (intention_id, category_id)).delete(db)


@router.delete(
    "/{category_id}",
    dependencies=[CanManageCategory],
    response_model=CategoryResponse,
)
def delete_category(
    category_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceCategoryEdit(current_user, category_id, db)
    return Category.get(db, category_id).delete(db)


@router.get(
    "",
    dependencies=[CanReadCategories],
    response_model=Categories,
)
def get_categories(
    db: Session = DependsOnDbSession,
):
    return db.query(Category).filter_by(parent_id=None).all()


@router.get(
    "/in_intention/{intention_id}",
    dependencies=[CanReadCategories],
    response_model=Categories,
)
def get_categories_by_intention(
    intention_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return [
        map_to_category_distribution(category, intention_id)
        for category in Category.get_categories(db)
    ]


@router.get(
    "/in_intention/{intention_id}/by_extraction/{digitization_list_id}",
    dependencies=[CanReadCategories],
    response_model=Categories,
)
def get_categories_by_extraction(
    intention_id: int = Path(...),
    digitization_list_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    extraction = Extraction.get(db, digitization_list_id)
    return [
        map_to_category_extraction(
            category,
            intention_id,
            extraction,
        )
        for category in Category.get_categories(db)
    ]


@router.get(
    "/in_intention/{intention_id}/by_digitizations",
    dependencies=[CanReadCategories],
    response_model=Categories,
)
def get_categories_by_digitization(
    intention_id: int = Path(...),
    digitization_ids: Optional[List[int]] = Query(
        None, description="Digitization ID"
    ),
    db: Session = DependsOnDbSession,
):
    if not digitization_ids:
        digitization_ids = [
            digitization.id
            for digitization in DigitizationList.get_by_intention(
                db, intention_id
            )
        ]
    return [
        map_to_category_digitization(
            category,
            intention_id,
            digitization_ids,
        )
        for category in Category.get_categories(db)
    ]


@router.get(
    "/departments/{department_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=Categories,
)
def get_department_categories(
    department_id: int = Path(...),
    current_user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceCategoryRead(current_user, department_id, db)
    return Category.get_department_categories(department_id, db)


@router.get(
    "/departments/{department_id}/in_intention/{intention_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=Categories,
)
def get_department_categories_by_intention(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return [
        map_to_category_distribution(category, intention_id)
        for category in (Category.get_department_categories(department_id, db))
    ]


@router.get(
    "/departments/{department_id}"
    "/in_intention/{intention_id}/by_extraction/{digitization_list_id}",
    dependencies=[CanReadDepartmentCategories],
    response_model=Categories,
)
def get_department_categories_by_extraction(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    digitization_list_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    extraction = Extraction.get(db, digitization_list_id)
    return [
        map_to_category_extraction(
            category,
            intention_id,
            extraction,
        )
        for category in (Category.get_department_categories(department_id, db))
    ]


@router.get(
    "/departments/{department_id}"
    "/in_intention/{intention_id}/by_digitizations",
    dependencies=[CanReadDepartmentCategories],
    response_model=Categories,
)
def get_department_categories_by_digitization(
    department_id: int = Path(...),
    intention_id: int = Path(...),
    digitization_ids: Optional[List[int]] = Query(
        None, description="Digitization ID"
    ),
    db: Session = DependsOnDbSession,
):
    if not digitization_ids:
        digitization_ids = [
            digitization.id
            for digitization in DigitizationList.get_by_intention(
                db, intention_id
            )
        ]
    return [
        map_to_category_digitization(
            category,
            intention_id,
            digitization_ids,
        )
        for category in (Category.get_department_categories(department_id, db))
    ]
