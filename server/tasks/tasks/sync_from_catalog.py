from sqlalchemy.orm import Session

from documents.models import Document
from documents.schemas import DocumentCreate
from tasks.tasks.documents_processing import run_task


UPDATE_COLUMN_NAMES = [
    "cnb",
    "isbn_issn",
    "signature",
    "material_type",
    "issuance_type",
    "title",
    "year",
    "bundle",
    "pages_count",
    "size",
    "publisher",
    "publishing_place",
    "publishing_year",
    "languages",
    "locationUri",
]
FREQUENCIES_COLUMN_NAME = "frequencies"


def update_document(
    document_id: int,
    new_document: DocumentCreate,
    username: str,
    db: Session,
) -> None:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        return

    for field in UPDATE_COLUMN_NAMES:
        setattr(document, field, getattr(new_document, field))

    frequencies = (
        [frequency.dict() for frequency in new_document.frequencies]
        if document.frequencies
        else []
    )
    setattr(document, FREQUENCIES_COLUMN_NAME, frequencies)

    db.commit()


def sync_from_catalog(task_id: int, owner: str, db: Session):
    from catalogs.enums import IdentifierType
    from catalogs.routines import generate_catalog_document
    from catalogs.schemas import Identifier
    from documents.schemas import DocumentCreate

    def update_document_from_catalog(document: Document):
        identifier = (
            Identifier(
                identifier_type=IdentifierType.Barcode, value=document.barcode
            )
            if document.barcode
            else Identifier(
                identifier_type=IdentifierType.Sysno, value=document.sysno
            )
        )

        catalog_response = generate_catalog_document(identifier)
        if catalog_response.document is None:
            raise ValueError(
                f"Document with identifier {identifier} not found in catalog"
            )
        newDocument = None
        if catalog_response.document.issues:
            issue = [
                issue
                for issue in catalog_response.document.issues
                if issue.barcode == document.barcode
            ][0]
            newDocument = DocumentCreate.from_catalog_issue(
                catalog_response.document, issue, document.category_id
            )
        else:
            newDocument = DocumentCreate.from_catalog_document(
                catalog_response.document, document.category_id
            )
        update_document(document.id, newDocument, owner, db)

    run_task(task_id, update_document_from_catalog, db)
