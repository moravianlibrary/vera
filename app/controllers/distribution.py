from fastapi import APIRouter, Path, Query

from custom_types import GeneralPermission, OwnershipPermission
from repositories import DistributionRepository
from schemas import Distribution, DistributionEdit
from services import DistributionService

from ._resources import (
    DependsOnDistributionRepository,
    DependsOnDistributionService,
)
from .security import WithPermission

router = APIRouter(prefix="/distributions", tags=["Distributions"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadDistributions)],
    response_model=Distribution,
)
def list(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.paginate(page=page, page_size=page_size)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def create(
    distribution: DistributionEdit,
    source_id: int | None = Path(None),
    initialize: bool = Path(False),
    service: DistributionService = DependsOnDistributionService,
):
    pass


@router.put(
    "/{distribution_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def update(
    distribution: DistributionEdit,
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.update(distribution_id, distribution)


@router.post(
    "/{source_id}/copy-to/{target_id}",
    dependencies=[
        WithPermission(GeneralPermission.ManageDistributions),
        WithPermission(OwnershipPermission.ManageCategoryDistributions),
    ],
    response_model=Distribution,
)
def copy(
    source_id: int = Path(..., description="ID of the source distribution"),
    target_id: int = Path(..., description="ID of the target distribution"),
    category_id: int | None = Query(
        None, description="Optional category to filter the copy operation"
    ),
    service: DistributionService = DependsOnDistributionService,
):
    return service.copy(source_id, target_id, category_id=category_id)


@router.put(
    "/{distribution_id}/set-as-active",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def set_as_active(
    distribution_id: int = Path(...),
    service: DistributionService = DependsOnDistributionService,
):
    return service.set_as_active(distribution_id)


@router.delete(
    "/{distribution_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def delete(
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    return repository.delete(repository.get_by_id(distribution_id))
