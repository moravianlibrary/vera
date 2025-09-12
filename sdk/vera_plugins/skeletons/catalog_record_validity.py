from vera_plugins.specs.base import ExternalResourceMixin
from vera_plugins.specs.catalog_record_property import (
    CatalogRecordInput,
    CatalogRecordValidityPlugin,
)

# If the plugin does require an external API/resource,
# include the ExternalResourceMixin.
# Otherwise, use CatalogRecordPropertyPlugin without it.


class Skeleton(CatalogRecordValidityPlugin, ExternalResourceMixin):
    """
    Skeleton for plugins that determine the validity of a catalog record.

    Methods
    -------
    parse(input_data : CatalogRecordInput) -> bool | None
        Determine if the catalog record is valid using the input data.

    is_available() -> bool
        Check whether the external resource is available.
    """

    def parse(self, input_data: CatalogRecordInput) -> bool | None:
        """
        Determine if the catalog record is valid using the input data.

        Parameters
        ----------
        input_data : CatalogRecordInput
            The input data containing the catalog record.

        Returns
        -------
        bool | None
            True if the record is valid, False if invalid, or None if unknown.
        """
        raise NotImplementedError("Implement the validity check logic here.")

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass
