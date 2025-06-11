from typing import NamedTuple

from marcdantic import MarcIssue, MarcRecord

from .base import (
    DataPropertyPluginBase,
    ExternalDataPropertyPluginBase,
    ExtractedProperties,
    PropertyType,
)


class DocumentInput(NamedTuple):
    """
    Input data for document property plugins.

    Parameters
    ----------
    record : MarcRecord
        The MARC record.
    issue : MarcIssue | None
        The MARC issue, if the record has multiple issues.
    catalog_properties : ExtractedProperties
        Previously extracted properties from the catalog record.
    document_properties : ExtractedProperties
        Previously extracted properties from the document.
    """

    record: MarcRecord
    issue: MarcIssue | None
    catalog_properties: ExtractedProperties
    document_properties: ExtractedProperties


class DocumentPropertyPlugin(
    DataPropertyPluginBase[DocumentInput, PropertyType],
):
    """
    Base class for plugins that extract a property from document input.

    Plugins should extract or derive a single JSON-compatible property from
    the input.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    parse(input_data : DocumentInput) -> PropertyType
        Extract a property from the given catalog record input.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.
    """


class ExternalDocumentPropertyPlugin(
    ExternalDataPropertyPluginBase[DocumentInput, PropertyType]
):
    """
    Base class for plugins that extract a property from document input
    using external resources.

    Extends the document property extraction by incorporating interaction
    with external resources such as APIs or remote services.

    Plugins should extract or derive a single JSON-compatible property from
    the input.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    is_available() -> bool
        Check if the required external resource is available.

    parse(input_data : DocumentInput) -> PropertyType
        Extract the property using both the input and external resources.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.
    """

    pass
