from marcdantic import MarcIssue, MarcRecord

from .base import (
    DataPropertyPluginBase,
    InputData,
    SpecificDataPropertyPluginBase,
)


class DocumentInput(InputData):
    """
    Input data for document property plugins.

    Parameters
    ----------
    record : MarcRecord
        The MARC record.
    issue : MarcIssue | None
        The MARC issue, if the record has multiple issues.
    """

    record: MarcRecord
    issue: MarcIssue | None


class DocumentPageCountPlugin(
    SpecificDataPropertyPluginBase[DocumentInput, int | None]
):
    """
    Base class for plugins that extract the page count from a document.

    Methods
    -------
    parse(input_data : DocumentInput) -> int | None
        Extract the page count using the input data.
    """


class DocumentCanBeExtractedPlugin(
    SpecificDataPropertyPluginBase[DocumentInput, bool | None]
):
    """
    Base class for plugins that determine if a document can be extracted.

    Methods
    -------
    parse(input_data : DocumentInput) -> bool | None
        Determine if the document can be extracted using the input data.
    """


class DocumentMarcIssuePropertyPlugin(
    SpecificDataPropertyPluginBase[str | None, str | None]
):
    """
    Base class for plugins that transform a MARC issue property
    from one format to another.

    Methods
    -------
    parse(input_data : str | None) -> str | None
        Transform the MARC issue property using the input data.
    """


class DocumentPropertyPlugin(
    DataPropertyPluginBase[DocumentInput],
):
    """
    Base class for plugins that extract a property from document input.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyData
        Extract a property from the given catalog record input.
    """
