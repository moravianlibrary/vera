from functools import lru_cache
from pathlib import Path
from typing import Dict, Set, Tuple

from vera_plugins.specs.catalog_record_property import (
    CatalogRecordPropertyPlugin,
)

from ..definitions.plugin_types import PluginType
from ..dispatchers import PLUGIN_TYPE_CARDINALITY
from ..schemas import PluginInstance, PluginMeta
from ..specs.base import PluginBase
from ..specs.catalog_adapter import CatalogAdapterPlugin
from ..specs.digitization_registry_adapter import (
    DigitizationRegistryAdapterPlugin,
)
from ..specs.document_discovery import DocumentDiscoveryPlugin
from ..specs.document_property import DocumentPropertyPlugin
from ..specs.identity_provider import IdentityProviderPlugin
from .loader import load_plugin_class
from .packager import unpack_plugin

PluginRegistryItem = Tuple[type[PluginBase], PluginInstance]


class PluginRegistry:
    def __init__(self):
        self._singleton_plugins: Dict[PluginType, PluginRegistryItem] = {}
        self._singleton_plugins_cache = lru_cache(maxsize=None)(
            self._load_singleton_plugin
        )

        self._multi_plugins: Dict[
            PluginType, Dict[int, PluginRegistryItem]
        ] = {
            plugin_type: {}
            for plugin_type, cardinality in PLUGIN_TYPE_CARDINALITY.items()
            if cardinality in ["0..*", "1..*"]
        }
        self._multi_plugins_cache = lru_cache(maxsize=None)(
            self._load_multi_plugin
        )
        self._multi_plugin_names: Dict[PluginType, Set[str]] = {
            plugin_type: set()
            for plugin_type, cardinality in PLUGIN_TYPE_CARDINALITY.items()
            if cardinality in ["0..*", "1..*"]
        }

    def _validate_cardinality(self, meta: PluginMeta) -> None:
        cardinality = PLUGIN_TYPE_CARDINALITY[meta.type]

        if (
            cardinality in ["1", "0..1"]
            and meta.type in self._singleton_plugins
        ):
            raise ValueError(
                f"Plugin of type '{meta.type.value}' is already registered."
            )
        if (
            cardinality in ["0..*", "1..*"]
            and meta.name in self._multi_plugin_names[meta.type]
        ):
            raise ValueError(
                f"Plugin '{meta.name}' of type '{meta.type.value}' "
                "is already registered."
            )

    def register_from_path(
        self,
        meta: PluginMeta,
        plugin_module_path: Path,
        instance: PluginInstance,
        instance_id: int | None = None,
    ) -> None:
        self._validate_cardinality(meta)
        PluginClass = load_plugin_class(meta.name, plugin_module_path)
        item = (PluginClass, instance)

        if PLUGIN_TYPE_CARDINALITY[meta.type] in ["1", "0..1"]:
            self._singleton_plugins[meta.type] = item
            return

        if instance_id is None:
            raise ValueError(
                "Instance ID must be provided for multi-instance plugins."
            )

        self._multi_plugins[meta.type][instance_id] = item
        self._multi_plugin_names[meta.type].add(meta.name)

    def register(
        self,
        meta: PluginMeta,
        plugin_package: bytes,
        instance: PluginInstance,
        instance_id: int | None = None,
    ) -> None:
        module_path = unpack_plugin(
            meta.name, meta.entrypoint_file, plugin_package
        )
        self.register_from_path(meta, module_path, instance, instance_id)

    def _load_plugin(self, item: PluginRegistryItem) -> PluginBase:
        PluginClass, instance = item
        return (
            PluginClass(instance.config) if instance.config else PluginClass()
        )

    def _load_singleton_plugin(self, plugin_type: PluginType) -> PluginBase:
        if plugin_type not in self._singleton_plugins:
            raise ValueError(
                f"No plugin registered for type '{plugin_type.value}'."
            )
        return self._load_plugin(self._singleton_plugins[plugin_type])

    def _load_multi_plugin(
        self, plugin_type: PluginType, instance_id: int
    ) -> PluginBase:
        if instance_id not in self._multi_plugins[plugin_type]:
            raise ValueError(
                f"No plugin registered for type '{plugin_type.value}' "
                f"with instance ID {instance_id}."
            )
        return self._load_plugin(self._multi_plugins[plugin_type][instance_id])

    def clear_plugin_cache(self):
        self._singleton_plugins_cache.cache_clear()
        self._multi_plugins_cache.cache_clear()

    @property
    def identity_provider(self) -> IdentityProviderPlugin:
        return self._load_singleton_plugin(PluginType.IdentityProvider)

    @property
    def catalog_adapter(self) -> CatalogAdapterPlugin:
        return self._load_singleton_plugin(PluginType.CatalogAdapter)

    @property
    def digitization_registry_adapter(
        self,
    ) -> DigitizationRegistryAdapterPlugin:
        return self._load_singleton_plugin(
            PluginType.DigitizationRegistryAdapter
        )

    def catalog_record_property(
        self, instance_id: int
    ) -> CatalogRecordPropertyPlugin:
        return self._load_multi_plugin(
            PluginType.CatalogRecordProperty, instance_id
        )

    def document_property(self, instance_id: int) -> DocumentPropertyPlugin:
        return self._load_multi_plugin(
            PluginType.DocumentProperty, instance_id
        )

    def document_discovery(self, instance_id: int) -> DocumentDiscoveryPlugin:
        return self._load_multi_plugin(
            PluginType.DocumentDiscovery, instance_id
        )
