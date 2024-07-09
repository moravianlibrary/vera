from catalogs.aleph_catalog.aleph_record import AlephRecord
from models.catalog_records import CatalogRecord
from pymarc import Record
from datetime import datetime
from config import VeraConfig
from typing import Optional


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
    return new_record


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
    return record


def delete_catalog_record(session, sysno):
    record = get_catalog_record_by_sysno(session, sysno)
    session.delete(record)
    session.commit()
    return record


def get_main_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.sysno, Record(record.marc))


def get_skc_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.skc_sysno, Record(record.skc_marc))


def get_cnb_aleph_record_by_sysno(session, sysno: str) -> AlephRecord:
    record = get_catalog_record_by_sysno(session, sysno)
    return AlephRecord(record.cnb_sysno, Record(record.cnb_marc))
