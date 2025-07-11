from vera_plugins.specs.base import ExternalResourceMixin
from vera_plugins.specs.document_property import (
    DocumentCanBeExtractedPlugin,
    DocumentInput,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use DocumentCanBeExtractedPlugin without it.


class Skeleton(DocumentCanBeExtractedPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that determine if a document can be extracted.

    Methods
    -------
    parse(input_data: DocumentInput) -> bool | None
        Determine if the document can be extracted using the input data.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: DocumentInput) -> bool | None:
        """
        Determine if the document can be extracted using the input data.

        Parameters
        ----------
        input_data : DocumentInput
            The input data containing the document information.

        Returns
        -------
        bool | None
            True if the document can be extracted, False if not,
            or None if unknown.
        """
        raise NotImplementedError(
            "Implement the extraction capability check logic here."
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
