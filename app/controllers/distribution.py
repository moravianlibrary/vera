from fastapi import APIRouter, Path, Query

from definitions.permission import OwnershipPermission
from repositories import DistributionRepository
from schemas.category import (
    Distribution,
    DistributionEdit,
    DistributionEditWithProportions,
)
from schemas.pagination import Page
from services import DistributionService

from ._locking import WithCategoryWriteLock
from ._resources import (
    DependsOnDistributionRepository,
    DependsOnDistributionService,
)
from ._security import WithPermission

router = APIRouter(prefix="/categories/distributions", tags=["Distributions"])


@router.get(
    "",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=Page[Distribution],
)
def paginate(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.paginate(page, page_size)


@router.post(
    "",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories, require_scope_all=True
        ),
        WithCategoryWriteLock,
    ],
    response_model=Distribution,
)
def create(
    distribution: DistributionEditWithProportions,
    service: DistributionService = DependsOnDistributionService,
):
    return service.create(distribution)


@router.put(
    "/{distribution_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories, require_scope_all=True
        ),
        WithCategoryWriteLock,
    ],
    response_model=Distribution,
)
def update(
    distribution: DistributionEditWithProportions,
    distribution_id: int = Path(...),
    service: DistributionService = DependsOnDistributionService,
):
    return service.update(distribution_id, distribution)


@router.put(
    "/{distribution_id}/description",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories, require_scope_all=True
        ),
    ],
    response_model=Distribution,
)
def update_description(
    distribution: DistributionEdit,
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.update(distribution_id, distribution)


@router.put(
    "/{distribution_id}/set-as-active",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories, require_scope_all=True
        )
    ],
    response_model=Distribution,
)
def set_as_active(
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.set_as_active(distribution_id)


@router.delete(
    "/{distribution_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories, require_scope_all=True
        )
    ],
    response_model=Distribution,
)
def delete(
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.delete(repository.get_by_id(distribution_id))
