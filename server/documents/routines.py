from sqlalchemy.orm import Session
from typing import Optional

from documents import crud, schemas
from catalogs.enums import IdentifierType
from catalogs.enums import CatalogResponseStatus as Status, DigitizationState
from catalogs.schemas import CatalogResponse, Identifier
from documents.enums import DocumentCreateResult as Result
from catalogs.routines import generate_catalog_document


CATALOG_RESPONSE_MAPPING = {
    Status.DocumentNotFound: Result.DocumentNotFoundInCatalog,
    Status.DocumentParsingError: Result.CatalogDocumentParsingError,
    Status.InvalidIdentifier: Result.InvalidIdentifier,
    Status.InvalidSysno: Result.InvalidSysno,
    Status.InvalidSysnoBase: Result.InvalidSysnoBase,
}


def create_document(
    document: schemas.DocumentCreate, creator: str, db: Session
):
    db_document = crud.get_document_by_identifiers(
        document.sysno, document.volume, document.barcode, db
    )
    if db_document is not None:
        return schemas.DocumentCreateResponse(
            create_result=Result.UniqueDocumentViolation,
        )

    return schemas.DocumentCreateResponse(
        document=crud.create_document(document, creator, db),
        create_result=Result.Success,
    )


def create_catalog_document(
    catalog_response: CatalogResponse,
    identifier: Identifier,
    category_id: Optional[int],
    insert_digitized: bool,
    username: str,
    db: Session,
):
    catalog_document = catalog_response.document
    response_status = catalog_response.response_status

    if response_status != Status.Success:
        return schemas.DocumentCreateResponse(
            create_result=CATALOG_RESPONSE_MAPPING.get(
                response_status, Result.CatalogError
            )
        )

    digitization_state = catalog_document.digitization_state
    document = None

    if identifier.identifier_type == IdentifierType.Barcode:
        if not catalog_document.issues:
            return schemas.DocumentCreateResponse(
                create_result=Result.InvalidCatalogDocument
            )
        if (
            digitization_state == DigitizationState.Finished
            and not insert_digitized
        ):
            return schemas.DocumentCreateResponse(
                create_result=Result.AlreadyDigitized
            )
        if (
            digitization_state == DigitizationState.InProgress
            and not insert_digitized
        ):
            return schemas.DocumentCreateResponse(
                create_result=Result.DigitizationInProgress
            )
        if (
            digitization_state == DigitizationState.Planned
            and not insert_digitized
        ):
            return schemas.DocumentCreateResponse(
                create_result=Result.DigitizationPlanned
            )

        issue = next(
            (
                issue
                for issue in catalog_document.issues
                if issue.barcode == identifier.value
            ),
            None,
        )

        create_issue = schemas.DocumentCreate.from_catalog_issue(
            catalog_document,
            issue,
            category_id,
        )
        response = create_document(create_issue, username, db)
        document = response.document
        create_result = response.create_result
    elif len(catalog_document.issues) > 1:
        create_result = Result.MultipleIssues
        for index, issue in enumerate(catalog_document.issues):
            catalog_document.issues[index].already_exists = (
                crud.get_document_by_identifiers(
                    catalog_document.sysno, issue.volume, issue.barcode, db
                )
                is not None
            )
    else:
        response = create_document(
            schemas.DocumentCreate.from_catalog_document(
                catalog_document, category_id
            ),
            username,
            db,
        )
        document = response.document
        create_result = response.create_result

    return schemas.DocumentCreateResponse(
        document=document,
        catalog_document=catalog_document,
        create_result=create_result,
    )


def update_document_from_catalog(
    document: schemas.Document, owner: str, db: Session
):
    catalog_response = generate_catalog_document(
        Identifier(IdentifierType.Barcode, document.barcode)
    )
    document = schemas.DocumentCreate.from_catalog_document(
        catalog_response.document
    )
    crud.update_document(document.id, document, owner, db)


def get_documents_query():
    pass
