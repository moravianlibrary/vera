from abc import abstractmethod
from dataclasses import dataclass
from typing import Generator

from .base import ExternalResourcePluginBase


@dataclass(frozen=True)
class DocumentRef:
    """
    Simple reference to a document by barcode.

    Attributes
    ----------
    barcode : str
        A globally unique identifier for the document.
    """

    barcode: str


@dataclass(frozen=True)
class CatalogDocumentRef:
    """
    Unique reference to a document within a catalog.

    Attributes
    ----------
    base : str
        The catalog base (e.g., 'SKC', 'MZK01').
    sysno : str
        The system number of the catalog record.
    barcode : Optional[str]
        An optional barcode or other identifier that distinguishes
        individual documents under the same catalog record.
        Required when a catalog record contains multiple documents.
    """

    base: str
    sysno: str
    barcode: str | None = None


DocumentPointer = DocumentRef | CatalogDocumentRef


class DocumentDiscoveryPlugin(ExternalResourcePluginBase):
    @abstractmethod
    def discover_documents(self) -> Generator[DocumentPointer, None, None]:
        """
        Yield references to documents to be added to the system.

        Returns
        -------
        Generator[DocumentPointer, None, None]
            A generator of `DocumentRef` or `CatalogDocumentRef`.
        """
        pass
