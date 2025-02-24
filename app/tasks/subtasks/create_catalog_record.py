from sqlalchemy.orm import Session
from mzk_aleph import AlephMzkIssue, AlephMzkRecord
from models import (
    CatalogRecord,
    CatalogRecordBarcode,
)
from .find_nkp_records import find_skc_sysno_and_marc, find_cnb_sysno_and_marc
from .catalog_record_differences import update_catalog_record_differences
from schemas import EsSession, IndexCatalogRecord


def create_catalog_record(
    session: Session, es_session: EsSession, mzk_record: AlephMzkRecord
) -> CatalogRecord:
    catalog_record = CatalogRecord(sysno=mzk_record.sysno)

    catalog_record.marc = mzk_record.record.as_marc()
    catalog_record.cnb = mzk_record.cnb
    catalog_record.language = mzk_record.language
    catalog_record.signature = mzk_record.signature
    catalog_record.isxn = mzk_record.isxn

    skc_sysno, skc_record = find_skc_sysno_and_marc(mzk_record)
    if skc_sysno is not None:
        if skc_record is None:
            raise Exception(f"SKC record {skc_sysno} not found")
        catalog_record.skc_sysno = skc_sysno
        catalog_record.skc_marc = skc_record.as_marc()

    cnb_sysno, cnb_record = find_cnb_sysno_and_marc(mzk_record)
    if cnb_sysno is not None:
        if cnb_record is None:
            raise Exception(f"CNB record {cnb_sysno} not found")
        catalog_record.cnb_sysno = cnb_sysno
        catalog_record.cnb_marc = cnb_record.as_marc()

    catalog_record.save(session)

    for issue in AlephMzkIssue.from_record(mzk_record.record):
        if issue.barcode is None:
            continue
        CatalogRecordBarcode(
            sysno=catalog_record.sysno, barcode=issue.barcode
        ).save(session)

    update_catalog_record_differences(session, catalog_record)

    IndexCatalogRecord.model_validate(catalog_record).save(es_session)

    return catalog_record
