from typing import NamedTuple

from marcdantic import MarcIssue, MarcRecord

from ..definitions.data_property import ExtractedProperties, PropertyType
from .base import DataPropertyPluginBase, ExternalDataPropertyPluginBase


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

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyType
        Extract a property from the given catalog record input.
    """


class ExternalDocumentPropertyPlugin(
    ExternalDataPropertyPluginBase[DocumentInput, PropertyType]
):
    """
    Base class for plugins that extract a property from document input
    using external resources.

    Extends the document property extraction by incorporating interaction
    with external resources such as APIs or remote services.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyType
        Extract the property using both the input and external resources.
    """

    pass
