from catalogs.nkp_catalog.nkp_aleph_client import nkpCatalogClient
from catalogs.aleph_catalog.aleph_issue import AlephIssue
from catalogs.aleph_catalog.aleph_record import AlephRecord
from typing import Optional
from datetime import datetime, timedelta

from catalogs.digitization_registry.digitization_registry_client import (
    GetDigitizationRegistryRecord,
)

from crud.catalog_records import (
    find_aleph_record,
    create_aleph_record,
    update_aleph_record,
)
from sqlalchemy.orm import Session
from crud.documents import create_document
from schemas.catalogs import Identifier
from catalogs.enums import IdentifierType
from catalogs.aleph_catalog.aleph_catalog_client import AlephCatalogClient


def add_document_by_identifier(identifier: Identifier):
    alephCatalogClient = AlephCatalogClient()

    if identifier.identifier_type == IdentifierType.Barcode:
        sysno = alephCatalogClient.find_sysno_by_barcode(identifier.value)
    elif identifier.identifier_type == IdentifierType.Signature:
        sysno = alephCatalogClient.find_sysno_by_signature(identifier.value)
    elif identifier.identifier_type == IdentifierType.Sysno:
        sysno = identifier.value
    else:
        raise Exception("Invalid identifier type")

    alephCatalogClient.get_marc21_document(sysno)


def add_document(
    session: Session,
    main_aleph_record: AlephRecord,
    barcode: Optional[str],
    added_by: str,
    category_id: int,
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
):
    issues = [
        issue
        for issue in AlephIssue.from_record(main_aleph_record)
        if issue.barcode == barcode
    ]

    if len(issues) > 1:
        # TODO: Handle multiple issues
        raise Exception(
            f"More than one issue found for barcode {barcode}"
            f" and sysno {main_aleph_record.sysno}"
        )
    if len(issues) == 0:
        # TODO: Handle no issue
        raise Exception(
            f"No issue found for barcode {barcode}"
            f" and sysno {main_aleph_record.sysno}"
        )

    issue = issues[0]
    catalog_record = find_aleph_record(session, main_aleph_record.sysno)

    if not catalog_record or (
        datetime.now() - catalog_record.last_updated
    ) > timedelta(hours=24):
        skc_aleph_record = nkpCatalogClient.get_skc_record(
            main_aleph_record.cnb, main_aleph_record.isxn
        )
        cnb_aleph_record = nkpCatalogClient.get_cnb_record(
            main_aleph_record.cnb, main_aleph_record.isxn
        )
        if not catalog_record:
            catalog_record = create_aleph_record(
                session,
                main_aleph_record,
                skc_aleph_record,
                0,
                cnb_aleph_record,
                0,
            )
        else:
            catalog_record = update_aleph_record(
                session,
                main_aleph_record,
                skc_aleph_record,
                0,
                cnb_aleph_record,
                0,
            )

    digitization_registry_record = GetDigitizationRegistryRecord(
        issue.barcode,
        main_aleph_record.cnb,
        main_aleph_record.isxn,
        issue.year,
        issue.volume,
        issue.bundle,
    )

    return create_document(
        session,
        main_aleph_record,
        issue,
        added_by,
        category_id,
        digitization_registry_record,
        pages_count_manual,
        extraction_priority,
    )
