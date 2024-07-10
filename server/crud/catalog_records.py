from pymarc import Record
from typing import Optional
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from models.catalog_records import CatalogRecord, CatalogRecordBarcode
from schemas.catalog_records import Identifier
from schemas.types.catalog_types import IdentifierType


def save_catalog_record(
    session,
    aleph_record: AlephRecord,
    skc_record: AlephRecord,
    skc_confidence: int,
    cnb_record: AlephRecord,
    cnb_confidence: int,
):
    record = session.merge(
        CatalogRecord(
            sysno=aleph_record.sysno,
            marc=aleph_record.record.as_marc(),
            cnb=aleph_record.cnb,
            signature=aleph_record.signature,
            isxn=aleph_record.isxn,
            skc_sysno=skc_record.sysno,
            skc_marc=skc_record.record.as_marc(),
            skc_confidence=skc_confidence,
            cnb_sysno=cnb_record.sysno,
            cnb_marc=cnb_record.record.as_marc(),
            cnb_confidence=cnb_confidence,
        )
    )

    session.commit()

    save_catalog_record_barcodes(session, aleph_record)

    return record


def save_catalog_record_barcodes(session, aleph_record: AlephRecord):
    session.query(CatalogRecordBarcode).filter_by(
        sysno=aleph_record.sysno
    ).delete()

    for issue in AlephIssue.from_record(aleph_record):
        if issue.barcode:
            session.add(
                CatalogRecordBarcode(
                    sysno=aleph_record.sysno,
                    barcode=issue.barcode,
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

    if identifier.identifier_type == IdentifierType.Cnb:
        return (
            session.query(CatalogRecord)
            .filter_by(cnb=identifier.value)
            .first()
        )

    if identifier.identifier_type == IdentifierType.Signature:
        return (
            session.query(CatalogRecord)
            .filter_by(signature=identifier.value)
            .first()
        )

    if identifier.identifier_type == IdentifierType.Isxn:
        return (
            session.query(CatalogRecord)
            .filter_by(isxn=identifier.value)
            .first()
        )

    return (
        session.query(CatalogRecord)
        .join(CatalogRecordBarcode)
        .filter(CatalogRecordBarcode.barcode == identifier.value)
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
