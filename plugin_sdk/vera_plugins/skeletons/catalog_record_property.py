from typing import Type

from esorm import ESBaseModel
from pydantic import BaseModel

from vera_plugins.specs.base import ExternalResourceMixin, PropertyData
from vera_plugins.specs.catalog_record_property import (
    CatalogRecordInput,
    CatalogRecordPropertyPlugin,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use CatalogRecordPropertyPlugin without it.


class Skeleton(CatalogRecordPropertyPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that extract a JSON-serializable property
    from structured catalog record input.

    Methods
    -------
    parse(input_data: CatalogRecordInput) -> PropertyType
        Extract a property from the given catalog record input.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: CatalogRecordInput) -> PropertyData:
        """
        Extract a property from the catalog record input data.

        Parameters
        ----------
        input_data : CatalogRecordInput
            The input data from which to extract the property.

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

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass
