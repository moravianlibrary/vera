from sqlalchemy.orm import Session, joinedload
from typing import Optional

from services.database import create
import models.documents as models
import schemas.documents as schemas
from services import exceptions
from catalogs.aleph_catalog.aleph_record import AlephRecord
from catalogs.aleph_catalog.aleph_issue import AlephIssue
from catalogs.digitization_registry.digitization_registry_record import (
    DigitizationRegistryRecord,
)
from catalogs.parsers import parse_page_count


def create_document(
    session: Session,
    main_aleph_record: AlephRecord,
    issue: AlephIssue,
    added_by: str,
    category_id: int,
    digitization_registry_record: DigitizationRegistryRecord,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> schemas.Document:
    if document_exists(
        session, main_aleph_record.sysno, issue.barcode, issue.volume
    ):
        raise exceptions.UniqueDocumentViolationException(
            main_aleph_record.sysno, issue.barcode, issue.volume
        )

    return create(
        session,
        models.Document(
            sysno=main_aleph_record.sysno,
            barcode=issue.barcode,
            volume=issue.volume,
            volume_year=issue.volume,
            bundle=issue.bundle,
            cnb=main_aleph_record.cnb,
            signature=main_aleph_record.signature,
            isxn=main_aleph_record.isxn,
            added_by=added_by,
            category_id=category_id,
            digitization_registry_id=digitization_registry_record.id,
            digitization_state=digitization_registry_record.digitization_state,
            pages_count_catalog=parse_page_count(
                main_aleph_record.extent, issue.volume
            ),
            pages_count_manual=pages_count_manual,
            extraction_priority=extraction_priority,
        ),
    )


def get_document_by_identifiers(
    sysno: str,
    barcode: Optional[str],
    volume: Optional[str],
    session: Session,
):
    query_base = session.query(models.Document).filter(
        models.Document.sysno == sysno
    )
    if barcode:
        return query_base.filter(models.Document.barcode == barcode).first()
    if volume:
        query_base = query_base.filter(models.Document.volume == volume)
    return query_base.first()


def document_exists(
    sysno: str,
    barcode: Optional[str],
    volume: Optional[str],
    session: Session,
) -> bool:
    return (
        get_document_by_identifiers(sysno, barcode, volume, session)
        is not None
    )


def get_document(session: Session, document_id: int) -> models.Document:
    document = (
        Session.query(models.Document)
        .options(joinedload(models.Document.category))
        .filter(models.Document.id == document_id)
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
    session: Session, document_id: int, main_aleph_record: AlephRecord
):
    document = get_document(session, document_id)

    document.cnb = main_aleph_record.cnb
    document.signature = main_aleph_record.signature
    document.isxn = main_aleph_record.isxn

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
