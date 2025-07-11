from vera_plugins.specs.document_property import (
    DocumentMarcIssuePropertyPlugin,
)


class Skeleton(DocumentMarcIssuePropertyPlugin):
    """
    Skeleton for a MARC issue property plugin.
    This class serves as a template for creating new plugins that
    transform MARC issue properties from one format to another.

    Methods
    -------
    parse(input_data : str | None) -> str | None
        Transform the MARC issue property using the input data.
    """

    def parse(self, input_data: str | None) -> str | None:
        """
        Transform the MARC issue property using the input data.

        Parameters
        ----------
        input_data : str | None
            The input data to transform.

        Returns
        -------
        str | None
            The transformed MARC issue property or None if not applicable.
        """
        raise NotImplementedError(
            "The parse method must be implemented in the subclass."
        )
