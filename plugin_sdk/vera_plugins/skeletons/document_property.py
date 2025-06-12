from vera_plugins.specs.document_property import (
    DocumentInput,
    DocumentPropertyPlugin,
    ExternalDocumentPropertyPlugin,
)

from ..definitions.data_property import PropertyType

# Choose one of the following classes based on your use case:
# - `Skeleton(DocumentPropertyPlugin)` for property extraction
#   that does not require external resources.
# - `Skeleton(ExternalDocumentPropertyPlugin)` for property extraction
#   that requires external resources (e.g., API, database).
# Replace return type PropertyType with the actual type you want to extract.


class Skeleton(DocumentPropertyPlugin):
    """
    Skeleton for plugins that extract a JSON-serializable property
    from structured document input.

    Use this base class when no external API/resource is needed.

    Methods
    -------
    parse(input_data : DocumentInput) -> PropertyType
        Extract a property from the given catalog record input.
    """

    def parse(self, input_data: DocumentInput) -> PropertyType:
        """
        Extract a property from the document input data.

        Parameters
        ----------
        input_data : DocumentInput
            The document input data from which to extract the property.

        Returns
        -------
        PropertyType
            The extracted property.
        """
        raise NotImplementedError(
            "Implement the property extraction logic here."
        )


class Skeleton(ExternalDocumentPropertyPlugin):
    """
    Skeleton for plugins that extract a property from a document
    using both structured input and external resources (e.g., API, database).

    Use this base class when external communication is required.

    Methods
    -------
    is_available() -> bool
        Check if the external resource is available.

    parse(input_data : DocumentInput) -> PropertyType
        Extract a property from the given document input and
        external resources.
    """

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        raise NotImplementedError(
            "Implement the availability check logic here."
        )

    def parse(self, input_data: DocumentInput) -> PropertyType:
        """
        Extract a property from the document input data.

        Parameters
        ----------
        input_data : DocumentInput
            The document input data from which to extract the property.

        Returns
        -------
        PropertyType
            The extracted property.
        """
        raise NotImplementedError(
            "Implement the property extraction logic here."
        )
