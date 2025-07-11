from vera_plugins.specs.base import ExternalResourceMixin
from vera_plugins.specs.catalog_record_property import (
    CatalogRecordInput,
    CatalogRecordMarcPropertyPlugin,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use CatalogRecordPropertyPlugin without it.


class Skeleton(CatalogRecordMarcPropertyPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that extract a string MARC property
    from a catalog record.

    Methods
    -------
    parse(input_data: CatalogRecordInput) -> str | None
        Extract the MARC property using the input data.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: CatalogRecordInput) -> str | None:
        """
        Extract the MARC property from the catalog record input data.

        Parameters
        ----------
        input_data : CatalogRecordInput
            The input data from which to extract the MARC property.

        Returns
        -------
        str | None
            The extracted MARC property or None if not found.
        """
        raise NotImplementedError(
            "Implement the MARC property extraction logic here."
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
