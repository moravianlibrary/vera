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

from .resources import (
    DependsOnSystemHealthRepository,
    DependsOnSystemSettingsRepository,
    DependsOnSystemStatusRepository,
    WithPermission,
)

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


@router.post(
    "/maintenance",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
)
def enable_maintenance_mode(
    message: str,
    repository: SystemStatusRepository = DependsOnSystemStatusRepository,
):
    repository.enable_maintenance_mode()
    return {"message": "System maintenance mode enabled."}


@router.delete(
    "/maintenance",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
)
def disable_maintenance_mode(
    repository: SystemStatusRepository = DependsOnSystemStatusRepository,
):
    repository.disable_maintenance_mode()
    return {"message": "System maintenance mode disabled."}
