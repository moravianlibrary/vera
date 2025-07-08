from typing import Type

from esorm import ESBaseModel
from pydantic import BaseModel

from vera_plugins.specs.base import PropertyData
from vera_plugins.specs.document_property import (
    DocumentInput,
    DocumentPropertyPlugin,
    ExternalDocumentPropertyPlugin,
)

# Choose one of the following classes based on your use case:
# - `Skeleton(DocumentPropertyPlugin)` for property extraction
#   that does not require external resources.
# - `Skeleton(ExternalDocumentPropertyPlugin)` for property extraction
#   that requires external resources (e.g., API, database).


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

    def parse(self, input_data: DocumentInput) -> PropertyData:
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

    @property
    def search_data_type(self) -> Type[ESBaseModel]:
        """
        The type of data intended for indexing and searching.

        Returns
        -------
        Type[ESBaseModel]
            The model class used for search data.
        """
        raise NotImplementedError("Implement the search data type logic here.")

    @property
    def detailed_data_type(self) -> Type[BaseModel]:
        """
        The type of data intended for detailed representation.

        Returns
        -------
        Type[BaseModel]
            The model class used for detailed dat
        """
        raise NotImplementedError(
            "Implement the detailed data type logic here."
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

    def parse(self, input_data: DocumentInput) -> PropertyData:
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

    @property
    def search_data_type(self) -> Type[ESBaseModel]:
        """
        The type of data intended for indexing and searching.

        Returns
        -------
        Type[ESBaseModel]
            The model class used for search data.
        """
        raise NotImplementedError("Implement the search data type logic here.")

    @property
    def detailed_data_type(self) -> Type[BaseModel]:
        """
        The type of data intended for detailed representation.

        Returns
        -------
        Type[BaseModel]
            The model class used for detailed dat
        """
        raise NotImplementedError(
            "Implement the detailed data type logic here."
        )
