from abc import abstractmethod
from typing import NamedTuple

from marcdantic import MarcRecord

from .base import (
    DataPropertyPluginBase,
    ExternalDataPropertyPluginBase,
    ExtractedProperties,
    PropertyType,
)


class CatalogRecordInput(NamedTuple):
    marc_record: MarcRecord
    properties: ExtractedProperties


class CatalogRecordPropertyPropagationMixin:
    """
    Mixin for catalog record property plugins that can propagate properties
    to documents.
    """

    @property
    @abstractmethod
    def propagate_to_documents(self) -> bool:
        """
        Indicates whether the extracted property should be propagated to
        documents.

        Returns
        -------
        bool
            True if the property should be propagated, False otherwise.
        """
        pass


class CatalogRecordPropertyPlugin(
    CatalogRecordPropertyPropagationMixin,
    DataPropertyPluginBase[CatalogRecordInput, PropertyType],
):
    """
    Base class for plugins that extract a property from a catalog record.

    Plugins should extract or derive a single JSON-compatible property from
    the input.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    parse(input_data : CatalogRecordInput) -> PropertyType
        Extract a property from the given catalog record input.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.

    propagate_to_documents() -> bool
        Return whether the extracted property should be propagated to
        documents.
    """


class ExternalCatalogRecordPropertyPlugin(
    CatalogRecordPropertyPropagationMixin,
    ExternalDataPropertyPluginBase[CatalogRecordInput, PropertyType],
):
    """
    Base class for plugins that extract a property from a catalog record using
    external resources.

    Extends the catalog record property extraction by incorporating
    interaction with external resources such as APIs or remote services.

    Plugins should extract or derive a single JSON-compatible property from
    the input.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    is_available() -> bool
        Check if the required external resource is available.

    parse(input_data : CatalogRecordInput) -> PropertyType
        Extract the property using both the input and external resources.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.

    propagate_to_documents() -> bool
        Return whether the extracted property should be propagated to
        documents.
    """

    pass
