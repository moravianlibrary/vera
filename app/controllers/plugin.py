from fastapi import APIRouter, Query
from vera_plugins.definitions.plugin_types import PluginType

from controllers._resources import (
    DependsOnPluginInstanceRepository,
    DependsOnPluginInstanceService,
    DependsOnPluginRepository,
    DependsOnPluginService,
)
from definitions.permission import GeneralPermission
from repositories.plugin import PluginInstanceRepository, PluginRepository
from schemas.pagination import Page
from schemas.plugin import (
    Plugin,
    PluginDiscoverParams,
    PluginInstance,
    PluginInstanceSummary,
)
from schemas.task import Task
from services.plugin import PluginInstanceService, PluginService

from ._security import WithPermission

# TODO: With lock ?
router = APIRouter(prefix="/plugins", tags=["Plugins"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Page[Plugin],
)
def paginate_plugins(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    filter_by_type: PluginType | None = None,
    repository: PluginRepository = DependsOnPluginRepository,
):
    return repository.paginate(page, page_size, filter_by_type)


@router.delete(
    "/{plugin_id}",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Plugin,
)
def delete_plugin(
    plugin_id: int,
    repository: PluginRepository = DependsOnPluginRepository,
    service: PluginService = DependsOnPluginService,
):
    return service.delete(repository.get_by_id(plugin_id))


@router.post(
    "/discover",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Task,
)
def discover_plugins(
    discover_params: PluginDiscoverParams,
    service: PluginService = DependsOnPluginService,
):
    return service.discover_plugins(discover_params)


instance_router = APIRouter(prefix="/instances", tags=["Plugin Instances"])
router.include_router(instance_router)


@instance_router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Page[PluginInstance],
)
def paginate_instances(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    filter_by_type: PluginType | None = None,
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
):
    return repository.paginate(page, page_size, filter_by_type)


@instance_router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def create_instance(
    plugin_name: str,
    instance_name: str,
    config: dict | None = None,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.create(plugin_name, instance_name, config)


@instance_router.put(
    "/{instance_id}",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def update_instance(
    instance_id: int,
    plugin_name: str,
    instance_name: str,
    config: dict | None = None,
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.update(
        repository.get_by_id(instance_id), plugin_name, instance_name, config
    )


@instance_router.delete(
    "/{instance_id}",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def delete_instance(
    instance_id: int,
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
):
    return repository.delete(instance_id)


@instance_router.post(
    "/discover",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Task,
)
def discover_instances(
    discover_params: PluginDiscoverParams,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.discover_plugins(discover_params)


@instance_router.get(
    "/summary/document-discovery",
    dependencies=[
        WithPermission(GeneralPermission.ReadDocumentDiscoveryPlugins)
    ],
    response_model=Page[PluginInstanceSummary],
)
def paginate_document_discovery_summary(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
):
    return repository.paginate(page, page_size, PluginType.DocumentDiscovery)
