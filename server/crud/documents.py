from sqlalchemy.orm import Session, joinedload
from typing import Optional

from services.database import create
import schemas.documents as schemas
from services import exceptions
from schemas.catalog_records import CatalogIssue
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from models import Document


def create_document(
    session: Session,
    main_aleph_record: AlephRecord,
    catalog_issue: CatalogIssue,
    added_by: str,
    category_id: int,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> schemas.Document:
    if document_exists(
        session,
        main_aleph_record.sysno,
        catalog_issue.barcode,
        catalog_issue.volume,
    ):
        raise exceptions.UniqueDocumentViolationException(
            main_aleph_record.sysno,
            catalog_issue.barcode,
            catalog_issue.volume,
        )

    return create(
        session,
        Document(
            sysno=main_aleph_record.sysno,
            barcode=catalog_issue.barcode,
            volume=catalog_issue.volume,
            volume_year=catalog_issue.volume,
            bundle=catalog_issue.bundle,
            document_signature=catalog_issue.signature,
            added_by=added_by,
            category_id=category_id,
            digitization_registry_id=catalog_issue.digitization_registry_id,
            digitization_state=catalog_issue.digitization_state,
            pages_count_catalog=main_aleph_record.parse_page_count(
                catalog_issue.volume
            ),
            pages_count_manual=pages_count_manual,
            extraction_priority=extraction_priority,
        ),
    )


def get_document_by_identifiers(
    session: Session,
    sysno: str,
    barcode: Optional[str],
    volume: Optional[str],
):
    query_base = session.query(Document).filter(Document.sysno == sysno)
    if barcode:
        return query_base.filter(Document.barcode == barcode).first()
    if volume:
        query_base = query_base.filter(Document.volume == volume)
    return query_base.first()


def document_exists(
    session: Session,
    sysno: str,
    barcode: Optional[str],
    volume: Optional[str],
) -> bool:
    return (
        get_document_by_identifiers(sysno, barcode, volume, session)
        is not None
    )


def get_document(session: Session, document_id: int) -> Document:
    document = (
        session.query(Document)
        .options(joinedload(Document.category))
        .filter(Document.id == document_id)
        .first()
    )
    if document is None:
        raise exceptions.DocumentNotFoundException(document_id)
    return document


def update_document_properties(
    session: Session,
    document_id: int,
    category_id: Optional[int] = None,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> schemas.Document:
    document = get_document(session, document_id)

    if category_id is not None:
        document.category_id = category_id
    if pages_count_manual is not None:
        document.pages_count_manual = pages_count_manual
    if extraction_priority is not None:
        document.extraction_priority = extraction_priority

    session.commit()
    session.refresh(document)

    return document


def update_document_identifiers(
    session: Session,
    document_id: int,
    main_aleph_record: AlephRecord,
    aleph_issue: AlephIssue,
) -> Document:
    document = get_document(session, document_id)

    document.barcode = aleph_issue.barcode
    document.volume = aleph_issue.volume
    document.volume_year = aleph_issue.volume
    document.bundle = aleph_issue.bundle
    document.document_signature = aleph_issue.signature
    document.pages_count_aleph = (
        main_aleph_record.parse_page_count(aleph_issue.volume),
    )

    session.commit()
    session.refresh(document)

    return document


def delete_document(session: Session, document_id: int):
    document = get_document(session, document_id)

    for task_document in document.task_documents:
        session.delete(task_document)

    session.delete(document)
    session.commit()
    return document
