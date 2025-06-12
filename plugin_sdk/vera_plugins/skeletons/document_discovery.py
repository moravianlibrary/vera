from typing import Generator

from vera_plugins.specs.document_discovery import (
    CatalogDocumentRef,
    DocumentDiscoveryPlugin,
    DocumentPointer,
    DocumentRef,
)


class Skeleton(DocumentDiscoveryPlugin):
    """
    Skeleton class for plugins that discover documents.

    Designed for plugins that yield references to documents
    to be added to the system, either as simple references or
    as catalog references.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    discover_documents() -> Generator[DocumentPointer, None, None]
        Yield references to documents to be added to the system.
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

    def discover_documents(self) -> Generator[DocumentPointer, None, None]:
        """
        Yield references to documents to be added to the system.

        Returns
        -------
        Generator[DocumentPointer, None, None]
            A generator of `DocumentRef` or `CatalogDocumentRef`.
        """
        raise NotImplementedError(
            "Implement the document discovery logic here."
        )
