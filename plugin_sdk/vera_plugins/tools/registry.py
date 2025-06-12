from pathlib import Path
from typing import Dict, Tuple

from ..definitions.dispatchers import PLUGIN_TYPE_CARDINALITY
from ..definitions.plugin_types import PluginType
from ..schemas import PluginInstance, PluginMeta
from ..specs.base import PluginBase
from ..specs.catalog_adapter import CatalogAdapterPlugin
from ..specs.digitization_registry_adapter import (
    DigitizationRegistryAdapterPlugin,
)
from .loader import load_plugin_class
from .packager import unpack_plugin

PluginRegistryItem = Tuple[type[PluginBase], PluginInstance]
PluginRegistryEntry = PluginRegistryItem | Dict[str, PluginRegistryItem]


class PluginRegistry:
    def __init__(self):
        self._registry: Dict[PluginType, PluginRegistryEntry] = {}

    def _validate_cardinality(self, meta: PluginMeta) -> None:
        cardinality = PLUGIN_TYPE_CARDINALITY[meta.type]

        if cardinality in ["1", "0..1"] and meta.type in self._registry:
            raise ValueError(
                f"Plugin of type '{meta.type.value}' is already registered."
            )
        if (
            meta.type in self._registry
            and meta.name in self._registry[meta.type]
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
    ) -> None:
        self._validate_cardinality(meta)
        PluginClass = load_plugin_class(meta.name, plugin_module_path)
        item = (PluginClass, instance)

        if PLUGIN_TYPE_CARDINALITY[meta.type] in ["1", "0..1"]:
            self._registry[meta.type] = item
            return

        if meta.type not in self._registry:
            self._registry[meta.type] = {}
        self._registry[meta.type][meta.name] = item

    def register(
        self, meta: PluginMeta, plugin_package: bytes, instance: PluginInstance
    ) -> None:
        module_path = unpack_plugin(
            meta.name, meta.entrypoint_file, plugin_package
        )
        self.register_from_path(meta, module_path, instance)

    def _load_single_plugin(self, plugin_type: PluginType) -> PluginBase:
        if plugin_type not in self._registry:
            raise ValueError(
                f"No plugin registered for type '{plugin_type.value}'."
            )

        entry = self._registry[plugin_type]
        if isinstance(entry, dict):
            raise ValueError(
                f"Multiple plugins registered for type '{plugin_type.value}'. "
                f"Use 'load_named_plugin' instead."
            )

        PluginClass, instance = entry
        return (
            PluginClass(instance.config) if instance.config else PluginClass()
        )

    def _load_named_plugin(
        self, plugin_type: PluginType, plugin_name: str
    ) -> PluginBase:
        if plugin_type not in self._registry:
            raise ValueError(
                f"No plugins registered for type '{plugin_type.value}'."
            )

        entry = self._registry[plugin_type]
        if not isinstance(entry, dict):
            raise ValueError(
                f"Single plugin registered for type '{plugin_type.value}'. "
                f"Use 'load_single_plugin' instead."
            )

        if plugin_name not in entry:
            raise ValueError(
                f"No plugin named '{plugin_name}' registered "
                f"for type '{plugin_type.value}'."
            )

        PluginClass, instance = entry[plugin_name]
        return (
            PluginClass(instance.config) if instance.config else PluginClass()
        )

    @property
    def catalog_adapter(self) -> CatalogAdapterPlugin:
        return self._load_single_plugin(PluginType.CatalogAdapter)

    @property
    def digitization_registry_adapter(
        self,
    ) -> DigitizationRegistryAdapterPlugin:
        return self._load_single_plugin(PluginType.DigitizationRegistryAdapter)
