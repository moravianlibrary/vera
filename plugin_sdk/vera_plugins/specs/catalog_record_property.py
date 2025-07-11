from marcdantic import MarcRecord

from .base import (
    DataPropertyPluginBase,
    InputData,
    SpecificDataPropertyPluginBase,
)


class CatalogRecordInput(InputData):
    """
    Input data for catalog record property plugins.

    Parameters
    ----------
    record : MarcRecord
        The MARC record representing the catalog record.
    """

    record: MarcRecord


class CatalogRecordValidityPlugin(
    SpecificDataPropertyPluginBase[CatalogRecordInput, bool | None]
):
    """
    Base class for plugins that determine the validity of a catalog record.

    Methods
    -------
    parse(input_data : CatalogRecordInput) -> bool | None
        Determine if the catalog record is valid using the input data.
    """


class CatalogRecordMarcPropertyPlugin(
    SpecificDataPropertyPluginBase[CatalogRecordInput, str | None]
):
    """
    Base class for plugins that extract a string MARC property from a catalog
    record.

    Methods
    -------
    parse(input_data : CatalogRecordInput) -> str | None
        Extract the MARC property using the input data.
    """


class CatalogRecordPropertyPlugin(DataPropertyPluginBase[CatalogRecordInput]):
    """
    Base class for plugins that extract a property from a catalog record.

    Methods
    -------
    parse(input_data : CatalogRecordInput) -> PropertyData
        Extract the property using both the input and external resources.
    """
