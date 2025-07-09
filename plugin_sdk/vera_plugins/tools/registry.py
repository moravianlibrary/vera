from pathlib import Path
from typing import Dict, Generic, NamedTuple, Set, TypeVar

from vera_plugins.specs.catalog_record_property import (
    CatalogRecordPropertyPlugin,
)

from ..definitions.plugin_types import PluginType
from ..dispatchers import PLUGIN_TYPE_CARDINALITY
from ..schemas import (
    CatalogAdapterConfig,
    CatalogRecordPropertyConfig,
    CatalogRecordValidityConfig,
    DigitizationRegistryConfig,
    DocumentCanBeExtractedConfig,
    DocumentDiscoveryConfig,
    DocumentPageCountConfig,
    DocumentPropertyConfig,
    IdentityProviderConfig,
    PluginConfig,
    PluginMeta,
)
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

TPlugin = TypeVar("TPlugin", bound=PluginBase)
TConfig = TypeVar("TConfig", bound=PluginConfig)


class PluginInstance(NamedTuple, Generic[TPlugin, TConfig]):
    plugin: TPlugin
    config: TConfig


class PluginRegistry:
    def __init__(self):
        self._singleton_plugins: Dict[PluginType, PluginInstance] = {}

        self._multi_plugins: Dict[PluginType, Dict[int, PluginInstance]] = {
            plugin_type: {}
            for plugin_type, cardinality in PLUGIN_TYPE_CARDINALITY.items()
            if cardinality in ["0..*", "1..*"]
        }

        self._multi_plugin_names: Dict[PluginType, Set[str]] = {
            plugin_type: set()
            for plugin_type, cardinality in PLUGIN_TYPE_CARDINALITY.items()
            if cardinality in ["0..*", "1..*"]
        }

    def _ensure_registration_allowed(
        self, meta: PluginMeta, instance_id: int | None
    ) -> None:
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
        if cardinality in ["0..*", "1..*"] and instance_id is None:
            raise ValueError(
                "Instance ID must be provided for multi-instance plugins."
            )

    def register_from_path(
        self,
        meta: PluginMeta,
        plugin_module_path: Path,
        config: PluginConfig,
        instance_id: int | None = None,
    ) -> None:
        self._ensure_registration_allowed(meta, instance_id)

        PluginClass = load_plugin_class(meta.name, plugin_module_path)
        plugin = (
            PluginClass(config.plugin_settings)
            if config.plugin_settings
            else PluginClass()
        )
        instance = PluginInstance(plugin, config)

        if PLUGIN_TYPE_CARDINALITY[meta.type] in ["1", "0..1"]:
            self._singleton_plugins[meta.type] = instance
            return

        self._multi_plugins[meta.type][instance_id] = instance
        self._multi_plugin_names[meta.type].add(meta.name)

    def register(
        self,
        meta: PluginMeta,
        plugin_package: bytes,
        instance: PluginConfig,
        instance_id: int | None = None,
    ) -> None:
        module_path = unpack_plugin(
            meta.name, meta.entrypoint_file, plugin_package
        )
        self.register_from_path(meta, module_path, instance, instance_id)

    def _get_singleton_plugin(
        self, plugin_type: PluginType
    ) -> PluginInstance[TPlugin, TConfig]:
        if plugin_type not in self._singleton_plugins:
            raise ValueError(
                f"No plugin registered for type '{plugin_type.value}'."
            )
        return self._singleton_plugins[plugin_type]

    def _get_multi_plugin(
        self, plugin_type: PluginType, instance_id: int
    ) -> PluginInstance[TPlugin, TConfig]:
        if instance_id not in self._multi_plugins[plugin_type]:
            raise ValueError(
                f"No plugin registered for type '{plugin_type.value}' "
                f"with instance ID {instance_id}."
            )
        return self._multi_plugins[plugin_type][instance_id]

    @property
    def identity_provider(
        self,
    ) -> PluginInstance[IdentityProviderPlugin, IdentityProviderConfig]:
        return self._get_singleton_plugin(PluginType.IdentityProvider)

    @property
    def catalog_adapter(
        self,
    ) -> PluginInstance[CatalogAdapterPlugin, CatalogAdapterConfig]:
        return self._get_singleton_plugin(PluginType.CatalogAdapter)

    @property
    def digitization_registry_adapter(
        self,
    ) -> PluginInstance[
        DigitizationRegistryAdapterPlugin,
        DigitizationRegistryConfig,
    ]:
        return self._get_singleton_plugin(
            PluginType.DigitizationRegistryAdapter
        )

    def catalog_record_validity(
        self, instance_id: int
    ) -> PluginInstance[
        CatalogRecordPropertyPlugin, CatalogRecordValidityConfig
    ]:
        return self._get_multi_plugin(
            PluginType.CatalogRecordValidity, instance_id
        )

    def catalog_record_property(
        self, instance_id: int
    ) -> PluginInstance[
        CatalogRecordPropertyPlugin, CatalogRecordPropertyConfig
    ]:
        return self._get_multi_plugin(
            PluginType.CatalogRecordProperty, instance_id
        )

    def document_page_count(
        self, instance_id: int
    ) -> PluginInstance[DocumentPropertyPlugin, DocumentPageCountConfig]:
        return self._get_multi_plugin(
            PluginType.DocumentPageCount, instance_id
        )

    def document_can_be_extracted(
        self, instance_id: int
    ) -> PluginInstance[DocumentPropertyPlugin, DocumentCanBeExtractedConfig]:
        return self._get_multi_plugin(
            PluginType.DocumentCanBeExtracted, instance_id
        )

    def document_property(
        self, instance_id: int
    ) -> PluginInstance[DocumentPropertyPlugin, DocumentPropertyConfig]:
        return self._get_multi_plugin(PluginType.DocumentProperty, instance_id)

    def document_discovery(
        self, instance_id: int
    ) -> PluginInstance[DocumentDiscoveryPlugin, DocumentDiscoveryConfig]:
        return self._get_multi_plugin(
            PluginType.DocumentDiscovery, instance_id
        )
