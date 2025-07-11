from vera_plugins.specs.base import ExternalResourceMixin
from vera_plugins.specs.document_property import (
    DocumentInput,
    DocumentMarcIssuePropertyPlugin,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use DocumentCanMarcIssuePropertyPlugin without it.


class Skeleton(DocumentMarcIssuePropertyPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that extract a MARC issue property
    from a document.

    Methods
    -------
    parse(input_data: DocumentInput) -> bool | None
        Determine if the document can be extracted using the input data.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: DocumentInput) -> str | None:
        """
        Extract the MARC issue property from the document input data.

        Parameters
        ----------
        input_data : DocumentInput
            The input data from which to extract the MARC issue property.

        Returns
        -------
        str | None
            The extracted MARC issue property or None if not found.
        """
        raise NotImplementedError(
            "Implement the MARC issue property extraction logic here."
        )

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass
