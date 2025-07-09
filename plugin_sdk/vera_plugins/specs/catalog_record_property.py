from marcdantic import MarcRecord

from .base import DataPropertyPluginBase, ExternalResourceMixin, InputData


class CatalogRecordInput(InputData):
    """
    Input data for catalog record property plugins.

    Parameters
    ----------
    record : MarcRecord
        The MARC record representing the catalog record.
    """

    record: MarcRecord


class CatalogRecordPropertyPlugin(DataPropertyPluginBase[CatalogRecordInput]):
    """
    Base class for plugins that extract a property from a catalog record.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyData
        Extract the property using both the input and external resources.
    """


class ExternalCatalogRecordPropertyPlugin(
    DataPropertyPluginBase[CatalogRecordInput], ExternalResourceMixin
):
    """
    Base class for plugins that extract a property from a catalog record using
    external resources.

    Extends the catalog record property extraction by incorporating interaction
    with external resources such as APIs or remote services.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    parse(input_data : DocumentInput) -> PropertyData
        Extract the property using both the input and external resources.
    """
