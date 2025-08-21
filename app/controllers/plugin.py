from typing import Annotated

from fastapi import APIRouter, Path, Query
from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import PluginConfig

from definitions.json import JsonObject
from definitions.permission import GeneralPermission
from repositories.plugin import PluginInstanceRepository, PluginRepository
from schemas.common import Page, PageParams
from schemas.plugin import (
    Plugin,
    PluginDiscoverParams,
    PluginInstance,
    PluginInstanceSummary,
    PluginsFilterParams,
)
from schemas.task import Task
from services.plugin import PluginInstanceService, PluginService

from .resources import (
    DependsOnPluginInstanceRepository,
    DependsOnPluginInstanceService,
    DependsOnPluginRepository,
    DependsOnPluginService,
    WithPermission,
)

router = APIRouter(prefix="/plugins", tags=["Plugins"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Page[Plugin],
)
def paginate_plugins(
    page_params: Annotated[PageParams, Query()],
    filter_params: Annotated[PluginsFilterParams, Query()],
    repository: PluginRepository = DependsOnPluginRepository,
):
    return repository.paginate(page_params, filter_params)


# TODO:
# @router.post(
#     "/discover",
#     dependencies=[WithPermission(GeneralPermission.ManageSystem)],
#     response_model=Task,
# )
# def discover_plugins(
#     discover_params: PluginDiscoverParams,
#     service: PluginService = DependsOnPluginService,
# ):
#     return service.discover_plugins(discover_params)


@router.get(
    "/{plugin_id}/config-schema",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=JsonObject,
)
def get_plugin_config_schema(
    plugin_id: int = Path(...),
    repository: PluginRepository = DependsOnPluginRepository,
    service: PluginService = DependsOnPluginService,
):
    return service.get_plugin_config_schema(repository.get_by_id(plugin_id))


@router.post(
    "/{plugin_id}/instance",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def create_instance(
    plugin_config: PluginConfig,
    plugin_id: int = Path(...),
    repository: PluginRepository = DependsOnPluginRepository,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.create(repository.get_by_id(plugin_id), plugin_config)


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
    "/instances/discover",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=Task,
)
def discover_instances(
    discover_params: PluginDiscoverParams,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.discover_plugins(discover_params)


@router.put(
    "/instances/{instance_id}",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def update_instance(
    instance_id: int,
    plugin_config: PluginConfig,
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.update(repository.get_by_id(instance_id), plugin_config)


@router.delete(
    "/instances/{instance_id}",
    dependencies=[WithPermission(GeneralPermission.ManageSystem)],
    response_model=PluginInstance,
)
def delete_instance(
    instance_id: int,
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
    service: PluginInstanceService = DependsOnPluginInstanceService,
):
    return service.delete(repository.get_by_id(instance_id))


@router.get(
    "/instances/summary/document-discovery",
    dependencies=[
        WithPermission(GeneralPermission.ReadDocumentDiscoveryPlugins)
    ],
    response_model=Page[PluginInstanceSummary],
)
def paginate_document_discovery_summary(
    page_params: Annotated[PageParams, Query()],
    repository: PluginInstanceRepository = DependsOnPluginInstanceRepository,
):
    return repository.paginate(page_params, PluginType.DocumentDiscovery)
