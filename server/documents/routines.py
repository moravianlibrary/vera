from sqlalchemy.orm import Session
from typing import Optional, Union

from documents import crud, schemas
from catalogs.enums import (
    CatalogResponseStatus as Status,
    DigitizationState,
    IdentifierType,
)
from catalogs.schemas import Identifier, CatalogResponse
from documents.enums import DocumentCreateResult as Result


CATALOG_RESPONSE_MAPPING = {
    Status.DocumentNotFound: Result.DocumentNotFoundInCatalog,
    Status.DocumentParsingError: Result.CatalogDocumentParsingError,
    Status.InvalidIdentifier: Result.InvalidIdentifier,
    Status.InvalidSysno: Result.InvalidSysno,
    Status.InvalidSysnoBase: Result.InvalidSysnoBase,
    Status.Success: None,
}
DIGITIZATION_RESULT_MAPPING = {
    DigitizationState.Finished: Result.AlreadyDigitized,
    DigitizationState.InProgress: Result.DigitizationInProgress,
    DigitizationState.Planned: Result.DigitizationPlanned,
}


def document_exists(document: schemas.DocumentCreate, db: Session):
    return crud.document_exists(
        document.sysno, document.volume, document.barcode, db
    )


def CatalogFailure(identifier: Identifier, catalog_response: CatalogResponse):
    return schemas.DocumentCreateResponse(
        identifier=identifier,
        create_result=CATALOG_RESPONSE_MAPPING.get(
            catalog_response.response_status
        ),
    )


def UniqueDocumentViolation(identifier: Identifier):
    return schemas.DocumentCreateResponse(
        identifier=identifier,
        create_result=Result.UniqueDocumentViolation,
    )


def SuccessfulyCreatedDocument(document: schemas.DocumentView):
    return schemas.DocumentCreateResponse(
        create_result=Result.Success,
        document=document,
    )


def InvalidCatalogDocument(identifier: Identifier):
    return schemas.DocumentCreateResponse(
        identifier=identifier, create_result=Result.InvalidCatalogDocument
    )


def DigitizationForbidden(identifier: Identifier):
    return schemas.DocumentCreateResponse(
        identifier=identifier, create_result=Result.DigitizationForbidden
    )


def DigitizedDocument(
    identifier: Identifier,
    catalog_document: Union[schemas.CatalogDocument, schemas.CatalogIssue],
):
    return schemas.DocumentCreateResponse(
        identifier=identifier,
        create_result=DIGITIZATION_RESULT_MAPPING.get(
            catalog_document.digitization_state
        ),
    )


def MultipleIssuesDocument(
    identifier: Identifier,
    catalog_document: schemas.CatalogDocument,
):
    return schemas.DocumentCreateResponse(
        identifier=identifier,
        create_result=Result.MultipleIssues,
        catalog_document=catalog_document,
    )


def create_document(
    document: schemas.DocumentCreate,
    creator: str,
    db: Session,
):
    if document_exists(document, db):
        UniqueDocumentViolation(
            Identifier(
                identifier_type=IdentifierType.Barcode, value=document.barcode
            )
        )

    return schemas.DocumentCreateResponse(
        document=crud.create_document(document, creator, db),
        create_result=Result.Success,
    )


def create_catalog_document_using_barcode(
    catalog_document: schemas.CatalogDocument,
    identifier: Identifier,
    category_id: Optional[int],
    insert_digitized: bool,
    username: str,
    db: Session,
):
    if not catalog_document.issues:
        return InvalidCatalogDocument(identifier)

    issue = next(
        (
            issue
            for issue in catalog_document.issues
            if issue.barcode == identifier.value
        ),
        None,
    )
    if issue is None:
        return InvalidCatalogDocument(identifier)

    if not catalog_document.issues[0].can_digitize:
        return DigitizationForbidden(identifier)
    if (
        not insert_digitized
        and catalog_document.digitization_state
        != DigitizationState.NotDigitized
    ):
        return DigitizedDocument(identifier, catalog_document)

    create_issue = schemas.DocumentCreate.from_catalog_issue(
        catalog_document,
        issue,
        category_id,
    )
    return create_document(create_issue, username, db)


def create_single_issue_catalog_document(
    catalog_document: schemas.CatalogDocument,
    identifier: Identifier,
    category_id: Optional[int],
    insert_digitized: bool,
    username: str,
    db: Session,
):
    if len(catalog_document.issues) == 1:
        if not catalog_document.issues[0].can_digitize:
            return DigitizationForbidden(identifier)
        if (
            not insert_digitized
            and catalog_document.issues[0].digitization_state
            != DigitizationState.NotDigitized
        ):
            return DigitizedDocument(identifier, catalog_document)

        create_issue = schemas.DocumentCreate.from_catalog_issue(
            catalog_document,
            catalog_document.issues[0],
            category_id,
        )
        return create_document(create_issue, username, db)

    if (
        not insert_digitized
        and catalog_document.digitization_state
        != DigitizationState.NotDigitized
    ):
        return DigitizedDocument(identifier, catalog_document)

    return create_document(
        schemas.DocumentCreate.from_catalog_document(
            catalog_document, category_id
        ),
        username,
        db,
    )


def generate_multiple_issues_response(
    identifier: Identifier,
    catalog_document: schemas.CatalogDocument,
    db: Session,
):
    for index, issue in enumerate(catalog_document.issues):
        catalog_document.issues[index].already_exists = (
            crud.get_document_by_identifiers(
                catalog_document.sysno, issue.volume, issue.barcode, db
            )
            is not None
        )
    return MultipleIssuesDocument(identifier, catalog_document)


def get_documents_query():
    pass
