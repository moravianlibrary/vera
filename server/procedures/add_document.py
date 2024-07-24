from typing import Optional, Tuple
from datetime import datetime, timedelta
from config import VeraConfig
from sqlalchemy.orm import Session
from services.external.digitization_registry import DigitizationState
from schemas.catalog_records import Identifier
from services.external.aleph import AlephClient
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from schemas import (
    CatalogDocumentResponse,
    CatalogIssueResponse,
)
from datatypes import (
    IdentifierType,
    AddDocumentResponseStatus,
    AlephToResponseStatusConverter,
    DigitizationStateToResponseStatusConverter,
    IdentifierToAlephFieldConverted,
)
from services import exceptions
from services.documents_indexer import DocumentsIndexer
from procedures.update_catalog_record import update_catalog_record
from services.external.aleph import AlephRecord
from services.external.aleph import AlephIssue
from services.external.aleph import AlephResponseStatus
from models import CatalogRecord, Document


def create_document(
    session: Session,
    main_aleph_record: AlephRecord,
    catalog_issue: CatalogIssueResponse,
    added_by: str,
    category_id: int,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> Document:
    return Document(
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
    ).save(session)


def add_document(
    session: Session,
    indexer: DocumentsIndexer,
    identifier: Identifier,
    added_by: str,
    category_id: int,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> Tuple[Optional[CatalogDocumentResponse], AddDocumentResponseStatus]:
    catalog_record = CatalogRecord.find_by_identifier(
        session, identifier.identifier_type, identifier.value
    )

    if not catalog_record or (
        datetime.now() - catalog_record.last_updated
    ) > timedelta(seconds=VeraConfig.CatalogRecordsValidFor):
        sysno, aleph_response_status = AlephClient().find_sysno(
            IdentifierToAlephFieldConverted[identifier.identifier_type],
            identifier.value,
        )

        if aleph_response_status != AlephResponseStatus.Success:
            return (
                None,
                AlephToResponseStatusConverter[aleph_response_status],
            )

        catalog_record, aleph_response_status = update_catalog_record(
            session, sysno
        )

        if aleph_response_status != AlephResponseStatus.Success:
            return (
                None,
                AlephToResponseStatusConverter[aleph_response_status],
            )

    main_aleph_record = AlephRecord(
        catalog_record.sysno, catalog_record.main_record
    )
    aleph_issues = AlephIssue.from_record(catalog_record.main_record)

    catalog_issues = [
        CatalogIssueResponse.from_aleph_issue(
            main_aleph_record,
            aleph_issue,
            DigitizationRegistryClient().get_record(
                aleph_issue.barcode,
                main_aleph_record.cnb,
                main_aleph_record.isxn,
                aleph_issue.volume_year,
                aleph_issue.volume,
                aleph_issue.bundle,
            ),
            Document.exists(
                session,
                main_aleph_record.sysno,
                aleph_issue.barcode,
                aleph_issue.volume,
                aleph_issue.volume_year,
                aleph_issue.bundle,
            ),
        )
        for aleph_issue in aleph_issues
        if (
            identifier.identifier_type != IdentifierType.Barcode
            or aleph_issue.barcode == identifier.value
        )
    ]

    num_of_all_issues = len(catalog_issues)
    num_of_active_issues = sum(
        1
        for catalog_issue in catalog_issues
        if catalog_issue.can_digitize and not catalog_issue.already_added
    )

    if (
        num_of_active_issues > 1
        or num_of_active_issues == 0
        and num_of_all_issues > 0
    ):
        return (
            CatalogDocumentResponse.from_records(
                main_aleph_record, catalog_issues, catalog_record
            ),
            AddDocumentResponseStatus.MultipleIssues,
        )

    if num_of_active_issues == 0 and num_of_all_issues == 0:
        add_issue = CatalogIssueResponse.from_aleph_record(
            main_aleph_record,
            DigitizationRegistryClient().get_record(
                cnb=main_aleph_record.cnb,
                isxn=main_aleph_record.isxn,
            ),
            Document.exists(session, main_aleph_record.sysno),
        )
    else:
        add_issue = catalog_issues[0]

    catalog_document = CatalogDocumentResponse.from_records(
        main_aleph_record, [add_issue], catalog_record
    )

    if add_issue.already_added:
        return catalog_document, AddDocumentResponseStatus.UniqueViolation

    if add_issue.digitization_state is None:
        return (
            catalog_document,
            AddDocumentResponseStatus.InvalidDigitizationState,
        )

    if add_issue.digitization_state != DigitizationState.NotDigitized:
        return (
            None,
            DigitizationStateToResponseStatusConverter[
                add_issue.digitization_state
            ],
        )

    try:
        document = create_document(
            session,
            main_aleph_record,
            add_issue,
            added_by,
            category_id,
            pages_count_manual,
            extraction_priority,
        )
        if document is None:
            return None, AddDocumentResponseStatus.UnknownError
    except exceptions.UniqueDocumentViolationException:
        return None, AddDocumentResponseStatus.UniqueViolation

    # TODO: handle exceptions
    indexer.index(document)

    return catalog_document, AddDocumentResponseStatus.Success
