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

router = APIRouter(prefix="/documents/additions", tags=["Document Additions"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadDistributions)],
    response_model=Distribution,
)
def search(
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    pass


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
    "/{addition_id}/archive",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def archive(
    distribution: DistributionEdit,
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    pass


@router.delete(
    "/{addition_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDistributions)],
    response_model=Distribution,
)
def delete(
    distribution_id: int = Path(...),
    repository: DistributionRepository = DependsOnDistributionRepository,
):
    pass
