from fastapi import APIRouter

from definitions.permission import GeneralPermission
from repositories.system import (
    SystemHealthRepository,
    SystemSettingsRepository,
    SystemStatusRepository,
)
from schemas.system import (
    SystemHealth,
    SystemSettings,
    SystemSettingsEdit,
    SystemStatus,
)

from ._resources import (
    DependsOnSystemHealthRepository,
    DependsOnSystemSettingsRepository,
    DependsOnSystemStatusRepository,
)
from ._security import WithPermission

router = APIRouter(prefix="/system", tags=["System"])


@router.get(
    "/health",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=SystemHealth,
)
def get_system_health(
    repository: SystemHealthRepository = DependsOnSystemHealthRepository,
):
    return repository.get_all()


@router.get(
    "/status",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=SystemStatus,
)
def get_system_status(
    repository: SystemStatusRepository = DependsOnSystemStatusRepository,
):
    return repository.get_all()


@router.get(
    "/settings",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=SystemSettings,
)
def get_system_settings(
    repository: SystemSettingsRepository = DependsOnSystemSettingsRepository,
):
    return repository.get_all()


@router.put(
    "/settings",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=SystemSettings,
)
def update_system_settings(
    settings: SystemSettingsEdit,
    repository: SystemSettingsRepository = DependsOnSystemSettingsRepository,
):
    return repository.update(settings)
