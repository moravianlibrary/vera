from documents import schemas
from catalogs.enums import DigitizationState
from documents.enums import IdentifierType
from catalogs.catalog_aleph import generate_document_by_identifier
from catalogs.digitization_registry import get_state_by_identifier
from catalogs.enums import DocumentCreateResult
from typing import Optional


def get_digitization_state(barcode: str, ccnb: Optional[str] = None):
    state = None
    if barcode:
        state = get_state_by_identifier(schemas.Identifier(
            identifier_type=IdentifierType.Barcode,
            value=barcode
        ))
    if ccnb and (state is None or state == DigitizationState.NOT_DIGITIZED):
        state = get_state_by_identifier(schemas.Identifier(
            identifier_type=IdentifierType.Ccnb,
            value=ccnb
        ))
    return state if state is not None else DigitizationState.NOT_DIGITIZED


def get_catalog_response(identifier: schemas.Identifier):
    document, create_result = generate_document_by_identifier(identifier)
    if document and document.issues:
        for index, issue in enumerate(document.issues):
            if issue.barcode is not None:
                document.issues[index].digitization_state = \
                    get_digitization_state(issue.barcode)
    digitization_state = None
    if create_result == DocumentCreateResult.PREPARED:
        digitization_state = get_digitization_state(
            document.barcode, document.ccnb)
    return schemas.DocumentCatalogResponse(
        identifier=identifier,
        document=document,
        digitization_state=digitization_state,
        create_result=create_result
    )
