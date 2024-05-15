from sqlalchemy.orm import Session
from typing import Optional

from documents import routines, schemas
from catalogs.enums import IdentifierType
from catalogs.enums import CatalogResponseStatus as Status
from catalogs.schemas import CatalogResponse, Identifier


def create_document(
    document: schemas.DocumentCreate, creator: str, db: Session
):
    return routines.create_document(document, creator, db)


def create_catalog_document(
    catalog_response: CatalogResponse,
    identifier: Identifier,
    category_id: Optional[int],
    insert_digitized: bool,
    username: str,
    db: Session,
):
    catalog_document = catalog_response.document
    catalog_response_status = catalog_response.response_status

    if catalog_response_status != Status.Success:
        return routines.CatalogFailure(identifier, catalog_response)

    if identifier.identifier_type == IdentifierType.Barcode:
        return routines.create_catalog_document_using_barcode(
            catalog_document,
            identifier,
            category_id,
            insert_digitized,
            username,
            db,
        )
    elif len(catalog_document.issues) > 1:
        return routines.generate_multiple_issues_response(catalog_document, db)

    return routines.create_single_issue_catalog_document(
        catalog_document,
        identifier,
        category_id,
        insert_digitized,
        username,
        db,
    )
