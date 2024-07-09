from typing import Optional, Tuple
from datetime import datetime, timedelta
from config import VeraConfig
from crud.catalog_records import (
    find_catalog_record_by_identifier,
    create_catalog_record,
    update_catalog_record,
)
from sqlalchemy.orm import Session
from crud.documents import create_document
from crud.documents import document_exists
from schemas.types.catalog_types import IdentifierType
from services.external.digitization_registry.types import DigitizationState
from schemas.catalog_records import Identifier
from services.external.aleph.client import AlephClient
from services.external.nkp_catalog.client import NkpAlephClient
from services.external.digitization_registry.client import (
    DigitizationRegistryClient,
)
from schemas.catalog_records import CatalogDocument, CatalogIssue
from schemas.types.documents_types import (
    AddDocumentResponseStatus,
    IDENTIFIER_TO_ALEPH_FIELD,
    DIGITIZATION_STATE_TO_RESPONSE_STATUS,
)
from services import exceptions


def add_document(
    session: Session,
    identifier: Identifier,
    added_by: str,
    category_id: int,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
) -> Tuple[Optional[CatalogDocument], AddDocumentResponseStatus]:
    catalog_record = find_catalog_record_by_identifier(session, identifier)

    if not catalog_record or (
        datetime.now() - catalog_record.last_updated
    ) > timedelta(seconds=VeraConfig.CatalogRecordsValidFor):
        main_aleph_record, aleph_response_status = AlephClient().get_record(
            IDENTIFIER_TO_ALEPH_FIELD[identifier.identifier_type],
            identifier.value,
        )

        if aleph_response_status != AddDocumentResponseStatus.Success:
            return None, aleph_response_status

        skc_aleph_record = NkpAlephClient().get_skc_record(
            main_aleph_record.cnb, main_aleph_record.isxn
        )
        cnb_aleph_record = NkpAlephClient().get_cnb_record(
            main_aleph_record.cnb, main_aleph_record.isxn
        )

        skc_confidence = 0
        cnb_confidence = 0

        if not catalog_record:
            catalog_record = create_catalog_record(
                session,
                main_aleph_record,
                skc_aleph_record,
                skc_confidence,
                cnb_aleph_record,
                cnb_confidence,
            )
        else:
            catalog_record = update_catalog_record(
                session,
                main_aleph_record,
                skc_aleph_record,
                skc_confidence,
                cnb_aleph_record,
                cnb_confidence,
            )
    else:
        main_aleph_record = catalog_record.aleph_record

    catalog_issues = [
        CatalogIssue.from_records(
            main_aleph_record,
            aleph_issue,
            DigitizationRegistryClient().get_record(
                aleph_issue.barcode,
                main_aleph_record.cnb,
                main_aleph_record.isxn,
                aleph_issue.year,
                aleph_issue.volume,
                aleph_issue.bundle,
            ),
            document_exists(
                session,
                main_aleph_record.sysno,
                aleph_issue.barcode,
                aleph_issue.volume,
            ),
        )
        for aleph_issue in catalog_record.aleph_issues
        if (
            identifier.identifier_type != IdentifierType.Barcode
            or aleph_issue.barcode == identifier.value
        )
    ]

    num_of_all_issues = len(catalog_issues)
    num_of_active_issues = len(
        catalog_issue
        for catalog_issue in catalog_issues
        if catalog_issue.can_digitize and not catalog_issue.already_added
    )

    if (
        num_of_active_issues > 1
        or num_of_active_issues == 0
        and num_of_all_issues > 0
    ):
        return (
            CatalogDocument.from_records(
                main_aleph_record, catalog_issues, catalog_record
            ),
            AddDocumentResponseStatus.MultipleIssues,
        )

    if num_of_active_issues == 0 and num_of_all_issues == 0:
        add_issue = CatalogIssue.from_aleph_record(
            main_aleph_record,
            DigitizationRegistryClient().get_record(
                cnb=main_aleph_record.cnb,
                isxn=main_aleph_record.isxn,
            ),
            document_exists(session, main_aleph_record.sysno, None, None),
        )
    else:
        add_issue = catalog_issues[0]

    catalog_document = CatalogDocument.from_records(
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
            DIGITIZATION_STATE_TO_RESPONSE_STATUS[
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

    return catalog_document, AddDocumentResponseStatus.Success
