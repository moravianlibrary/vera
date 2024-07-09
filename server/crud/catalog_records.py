from pymarc import Record
from datetime import datetime
from typing import Optional
from config import VeraConfig
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from models.catalog_records import CatalogRecord, CatalogRecordIdentifier
from schemas.catalog_records import Identifier
from schemas.types.catalog_types import IdentifierType
from sqlalchemy import and_


def create_catalog_record(
    session,
    aleph_record: AlephRecord,
    skc_record: AlephRecord,
    skc_confidence: int,
    cnb_record: AlephRecord,
    cnb_confidence: int,
):
    new_record = CatalogRecord(
        sysno=aleph_record.sysno,
        marc=aleph_record.record.as_marc(),
        skc_sysno=skc_record.sysno,
        skc_marc=skc_record.record.as_marc(),
        skc_confidence=skc_confidence,
        cnb_sysno=cnb_record.sysno,
        cnb_marc=cnb_record.record.as_marc(),
        cnb_confidence=cnb_confidence,
    )
    session.add(new_record)
    session.commit()

    save_catalog_record_identifiers(session, aleph_record)

    return new_record


def save_catalog_record_identifiers(session, aleph_record: AlephRecord):
    session.query(CatalogRecordIdentifier).filter_by(
        sysno=aleph_record.sysno
    ).delete()

    if aleph_record.cnb:
        session.add(
            CatalogRecordIdentifier(
                catalog_record_sysno=aleph_record.sysno,
                identifier=IdentifierType.Cnb,
                value=aleph_record.cnb,
            )
        )
    if aleph_record.isxn:
        session.add(
            CatalogRecordIdentifier(
                catalog_record_sysno=aleph_record.sysno,
                identifier=IdentifierType.Isxn,
                value=aleph_record.isxn,
            )
        )
    if aleph_record.signature:
        session.add(
            CatalogRecordIdentifier(
                catalog_record_sysno=aleph_record.sysno,
                identifier=IdentifierType.Signature,
                value=aleph_record.signature,
            )
        )

    for issue in AlephIssue.from_record(aleph_record):
        if issue.barcode:
            session.add(
                CatalogRecordIdentifier(
                    catalog_record_sysno=aleph_record.sysno,
                    identifier=IdentifierType.Barcode,
                    value=issue.barcode,
                )
            )

    session.commit()


def find_catalog_record(session, sysno) -> Optional[CatalogRecord]:
    return session.query(CatalogRecord).filter_by(sysno=sysno).first()


def get_catalog_record_by_sysno(session, sysno):
    record = find_catalog_record(session, sysno)
    if record is None:
        raise ValueError(f"Record with sysno {sysno} not found")
    return record


def update_catalog_record(
    session,
    aleph_record: AlephRecord,
    skc_record: AlephRecord,
    skc_confidence: int,
    cnb_record: AlephRecord,
    cnb_confidence: int,
):
    record = get_catalog_record_by_sysno(session, aleph_record.sysno)
    record.marc = aleph_record.record.as_marc()
    record.skc_sysno = skc_record.sysno
    record.skc_marc = skc_record.record.as_marc()
    record.skc_confidence = skc_confidence
    record.cnb_sysno = cnb_record.sysno
    record.cnb_marc = cnb_record.record.as_marc()
    record.cnb_confidence = cnb_confidence
    record.last_updated = datetime.now(VeraConfig.TimeZone)
    session.commit()

    save_catalog_record_identifiers(session, aleph_record)

    return record


def delete_catalog_record(session, sysno):
    record = get_catalog_record_by_sysno(session, sysno)
    session.delete(record)
    session.commit()
    return record


def find_catalog_record_by_identifier(
    session, identifier: Identifier
) -> Optional[CatalogRecord]:
    if identifier.identifier_type == IdentifierType.Sysno:
        return find_catalog_record(session, identifier.value)
    return (
        session.query(CatalogRecord)
        .join(CatalogRecordIdentifier)
        .filter(
            and_(
                CatalogRecordIdentifier.identifier
                == identifier.identifier_type,
                CatalogRecordIdentifier.value == identifier.value,
            )
        )
        .first()
    )


def get_main_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.sysno, Record(record.marc))


def get_skc_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.skc_sysno, Record(record.skc_marc))


def get_cnb_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.cnb_sysno, Record(record.cnb_marc))
