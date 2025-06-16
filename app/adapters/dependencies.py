from fastapi import Depends, Request
from vera_plugins.tools.registry import PluginRegistry


def get_plugin_registry(request: Request) -> PluginRegistry:
    return request.app.state.plugin_registry


DependsOnPluginRegistry = Depends(get_plugin_registry)


def get_catalog_adapter_dependency(
    plugin_registry: PluginRegistry = DependsOnPluginRegistry,
    db_session: DatabaseSession = DependsOnDatabaseSession,
) -> CatalogAdapter:
    """
    Dependency to get the catalog adapter instance.
    """
    return CatalogAdapter(plugin_registry, instance)


DependsOnCatalogAdapter = Depends(get_catalog_adapter_dependency)
