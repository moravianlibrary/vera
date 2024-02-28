import re
import pickle
import os
from typing import Dict, Optional, Tuple

from catalogs import aleph_api
from catalogs.aleph_document import AlephDocument
from catalogs.enums import CatalogResponseStatus, IdentifierType
from catalogs.parsers import from_aleph_document
from catalogs.schemas import CatalogDocument, CatalogResponse, Identifier


SYSNO_FORMAT_1 = r"^\d{9}$"
SYSNO_FORMAT_2 = r"^(?:MZK|mzk)(\d{2})-?(\d{9})$"


class LRUCache:
    def __init__(
        self, capacity: int = 100, cache_file: str = "/tmp/catalog_cache.pkl"
    ):
        self.capacity = capacity
        self.cache_file = cache_file
        self.barcode_cache: Dict[str, CatalogDocument] = {}
        self.cache: Dict[str, CatalogDocument] = self.load_cache()

    def load_cache(self):
        if os.path.exists(self.cache_file):
            with open(self.cache_file, "rb") as f:
                documents: Dict[str, CatalogDocument] = pickle.load(f)
                for document in documents.values():
                    self.put_documents_by_barcode(document)
                return documents
        return {}

    def save_cache(self) -> Dict[str, CatalogDocument]:
        with open(self.cache_file, "wb") as f:
            pickle.dump(self.cache, f)

    def get(self, sysno) -> Optional[CatalogDocument]:
        if sysno in self.cache:
            document = self.cache.pop(sysno)
            self.cache[sysno] = document
            return document
        return None

    def put(self, sysno, document: CatalogDocument):
        if len(self.cache) >= self.capacity:
            self.cache.popitem(last=False)
        self.cache[sysno] = document
        self.put_documents_by_barcode(document)
        self.save_cache()

    def get_document_by_barcode(
        self, barcode: str
    ) -> Optional[CatalogDocument]:
        return self.barcode_cache.get(barcode)

    def put_documents_by_barcode(self, document: CatalogDocument):
        for issue in document.issues:
            if issue.barcode:
                self.barcode_cache[issue.barcode] = document


document_cache = LRUCache()


def get_document_by_sysno(sysno: str):
    if re.match(SYSNO_FORMAT_1, sysno):
        for base in aleph_api.SYSNO_BASES:
            document = aleph_api.get_catalog_document(f"{base}-{sysno}")
            if document is not None:
                return document, CatalogResponseStatus.Success
    elif re.match(SYSNO_FORMAT_2, sysno):
        formatted = re.sub(SYSNO_FORMAT_2, r"MZK\1-\2", sysno)
        base = formatted.split("-")[0]
        if base not in aleph_api.SYSNO_BASES:
            return None, CatalogResponseStatus.InvalidSysnoBase
        document = aleph_api.get_catalog_document(formatted)
        if document is None:
            return None, CatalogResponseStatus.DocumentNotFound
        return document, CatalogResponseStatus.Success
    else:
        return None, CatalogResponseStatus.InvalidSysno


def get_document_by_identifier(
    identifier: Identifier,
) -> Tuple[Optional[AlephDocument], CatalogResponseStatus]:
    sysno, document = None, None

    if identifier.identifier_type == IdentifierType.Sysno:
        document = document_cache.get(identifier.value)
        if document is None:
            sysno = identifier.value
    elif identifier.identifier_type == IdentifierType.Barcode:
        document = document_cache.get_document_by_barcode(identifier.value)
        if document is None:
            sysno = aleph_api.find_sysno_by_barcode(identifier.value)
    elif identifier.identifier_type == IdentifierType.Signature:
        sysno = aleph_api.find_sysno_by_signature(identifier.value)
    else:
        return None, CatalogResponseStatus.InvalidIdentifier

    if document:
        print(f"Returning cache catalog document with sysno {document.sysno}")
        return document, CatalogResponseStatus.Success

    if sysno is None:
        return None, CatalogResponseStatus.DocumentNotFound

    document, response = get_document_by_sysno(sysno)
    if response != CatalogResponseStatus.Success:
        return document, response

    document_cache.put(sysno, document)
    return document, CatalogResponseStatus.Success


def generate_catalog_document(identifier: Identifier):
    document, response_status = get_document_by_identifier(identifier)
    return CatalogResponse(
        document=(from_aleph_document(document) if document else None),
        response_status=response_status,
    )
