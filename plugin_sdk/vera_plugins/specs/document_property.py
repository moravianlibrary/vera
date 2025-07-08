from marcdantic import MarcIssue, MarcRecord

from .base import (
    DataPropertyPluginBase,
    ExternalDataPropertyPluginBase,
    InputData,
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


class ExternalDocumentPropertyPlugin(
    ExternalDataPropertyPluginBase[DocumentInput]
):
    """
    Base class for plugins that extract a property from document input
    using external resources.

    Extends the document property extraction by incorporating interaction
    with external resources such as APIs or remote services.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyData
        Extract the property using both the input and external resources.
    """

    pass
