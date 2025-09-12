from vera_plugins.specs.base import ExternalResourceMixin
from vera_plugins.specs.document_property import (
    DocumentInput,
    DocumentPageCountPlugin,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use DocumentPageCountPlugin without it.


class Skeleton(DocumentPageCountPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that extract the page count from a document.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyType
        Extract a property from the given catalog record input.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: DocumentInput) -> int | None:
        """
        Extract the page count from the document input data.

        Parameters
        ----------
        input_data : DocumentInput
            The input data from which to extract the page count.

        Returns
        -------
        int | None
            The extracted page count, or None if not available.
        """
        raise NotImplementedError(
            "Implement the page count extraction logic here."
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
