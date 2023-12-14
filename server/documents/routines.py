from sqlalchemy.orm import Session
from typing import Optional

from documents import crud, schemas
from documents.enums import IdentifierType
from catalogs.enums import DigitizationState, DocumentCreateResult


def create_document_from_schema(document: schemas.DocumentCreateResponse,
                                creator_id: int,
                                db: Session):
    created_document = None
    create_result = DocumentCreateResult.UNIQUE_DOCUMENT_VIOLATION
    db_document = crud.get_document_by_identifiers(
        document.sysno, document.volume_number, db
    )
    if db_document is None:
        created_document = crud.create_document(document, creator_id, db)
        create_result = DocumentCreateResult.SUCCESS
    return schemas.DocumentCreateResponse(
        identifier=schemas.Identifier(
            identifier_type=IdentifierType.SYSNO, value=document.sysno),
        document=created_document,
        create_result=create_result
    )


def create_catalog_document(catalog_document_response:
                            schemas.DocumentCatalogResponse,
                            category_id: Optional[int],
                            insert_digitized: bool,
                            user_id: int,
                            db: Session):
    catalog_document = catalog_document_response.document
    digitization_state = catalog_document_response.digitization_state
    create_result = catalog_document_response.create_result
    document = None

    if create_result != DocumentCreateResult.PREPARED:
        pass
    elif len(catalog_document.issues) > 1:
        create_result = DocumentCreateResult.MULTIPLE_ISSUE_CHOICES
    elif digitization_state != DigitizationState.NOT_DIGITIZED \
            and not insert_digitized:
        create_result = DocumentCreateResult.ALREADY_DIGITIZED
    else:
        response = create_document_from_schema(
            schemas.DocumentCreate
            .from_catalog_document(
                catalog_document, category_id, digitization_state
                ),
            user_id,
            db
        )
        document = response.document
        create_result = response.create_result

    return schemas.DocumentCreateResponse(
        identifier=catalog_document_response.identifier,
        document=document,
        catalog_document=catalog_document,
        digitization_state=digitization_state,
        create_result=create_result
    )


def get_documents_query():
    pass
