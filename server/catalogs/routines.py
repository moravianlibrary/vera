import re
from typing import Optional, Tuple

from catalogs import aleph_api
from catalogs.aleph_document import AlephDocument
from catalogs.enums import CatalogResponseStatus, IdentifierType
from catalogs.parsers import from_aleph_document
from catalogs.schemas import CatalogResponse, Identifier


SYSNO_FORMAT_1 = r"^\d{9}$"
SYSNO_FORMAT_2 = r"^(?:MZK|mzk)(\d{2})-?(\d{9})$"


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
    if identifier.identifier_type == IdentifierType.Sysno:
        return get_document_by_sysno(identifier.value)
    if identifier.identifier_type == IdentifierType.Barcode:
        sysno = aleph_api.find_sysno_by_barcode(identifier.value)
        if sysno is None:
            return None, CatalogResponseStatus.DocumentNotFound
        return get_document_by_sysno(sysno)
    if identifier.identifier_type == IdentifierType.Signature:
        sysno = aleph_api.find_sysno_by_signature(identifier.value)
        if sysno is None:
            return None, CatalogResponseStatus.DocumentNotFound
        return get_document_by_sysno(sysno)

    return None, CatalogResponseStatus.InvalidIdentifier


def generate_catalog_document(identifier: Identifier):
    document, response_status = get_document_by_identifier(identifier)
    return CatalogResponse(
        document=(from_aleph_document(document) if document else None),
        response_status=response_status,
    )
