from typing import NamedTuple

from marcdantic import MarcRecord

from ..definitions.data_property import ExtractedProperties, PropertyType
from .base import DataPropertyPluginBase, ExternalDataPropertyPluginBase


class CatalogRecordInput(NamedTuple):
    marc_record: MarcRecord
    properties: ExtractedProperties


class CatalogRecordPropertyPlugin(
    DataPropertyPluginBase[CatalogRecordInput, PropertyType]
):
    """
    Base class for plugins that extract a property from a catalog record.
    """


class ExternalCatalogRecordPropertyPlugin(
    ExternalDataPropertyPluginBase[CatalogRecordInput, PropertyType],
):
    """
    Base class for plugins that extract a property from a catalog record using
    external resources.

    Extends the catalog record property extraction by incorporating interaction
    with external resources such as APIs or remote services.
    """
