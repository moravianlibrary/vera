from documents import schemas
from catalogs.enums import DigitizationState
from documents.enums import IdentifierType
from catalogs.catalog_aleph import generate_document_by_identifier
from catalogs.digitization_registry import get_state_by_identifier
from catalogs.enums import DocumentCreateResult


def get_digitization_state(document: schemas.DocumentCatalog):
    if document.barcode:
        state = get_state_by_identifier(schemas.Identifier(
            identifier_type=IdentifierType.BARCODE,
            value=document.barcode
        ))
    if document.ccnb and (state is None
                          or state == DigitizationState.NOT_DIGITIZED):
        state = get_state_by_identifier(schemas.Identifier(
            identifier_type=IdentifierType.CCNB,
            value=document.ccnb
        ))
    return state


def get_catalog_response(identifier: schemas.Identifier):
    document, create_result = generate_document_by_identifier(identifier)
    digitization_state = None
    if create_result == DocumentCreateResult.PREPARED:
        digitization_state = get_digitization_state(document)
    return schemas.DocumentCatalogResponse(
        identifier=identifier,
        document=document,
        digitization_state=digitization_state,
        create_result=create_result
    )
