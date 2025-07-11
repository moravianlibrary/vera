from vera_plugins.specs.catalog_record_property import (
    CatalogRecordMarcPropertyPlugin,
)


class Skeleton(CatalogRecordMarcPropertyPlugin):
    """
    Skeleton for a MARC property plugin.
    This class serves as a template for creating new plugins that
    transform MARC properties from one format to another.

    Methods
    -------
    parse(input_data : str | None) -> str | None
        Transform the MARC property using the input data.
    """

    def parse(self, input_data: str | None) -> str | None:
        """
        Transform the MARC property using the input data.

        Parameters
        ----------
        input_data : str | None
            The input data to transform.

        Returns
        -------
        str | None
            The transformed MARC property or None if not applicable.
        """
        raise NotImplementedError(
            "The parse method must be implemented in the subclass."
        )
