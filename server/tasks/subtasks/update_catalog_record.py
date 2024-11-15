from sqlalchemy.orm import Session
from mzk_aleph import AlephMzkIssue, AlephMzkRecord
from models import (
    CatalogRecord,
    CatalogRecordBarcode,
)
from .find_nkp_records import find_skc_sysno_and_marc, find_cnb_sysno_and_marc
from .catalog_record_differences import update_catalog_record_differences
from dispatchers import get_mzk_client, get_skc_client, get_cnb_client
from schemas import EsSession, IndexCatalogRecord


def update_catalog_record(
    session: Session, es_session: EsSession, catalog_record: CatalogRecord
) -> CatalogRecord:
    sysno_split = catalog_record.sysno.split("-")
    mzk_record, _ = get_mzk_client().get_record(sysno_split[0], sysno_split[1])
    mzk_record: AlephMzkRecord

    if mzk_record is None:
        raise Exception(f"MZK record {catalog_record.sysno} not found")

    catalog_record.marc = mzk_record.record.as_marc()
    catalog_record.cnb = mzk_record.cnb
    catalog_record.language = mzk_record.language
    catalog_record.signature = mzk_record.signature
    catalog_record.isxn = mzk_record.isxn

    if catalog_record.skc_sysno is not None:
        skc_record = get_skc_client().get_record(catalog_record.skc_sysno)
        if catalog_record.skc_record is not None and skc_record is None:
            raise Exception(f"SKC record {catalog_record.skc_sysno} not found")
        catalog_record.skc_marc = skc_record.as_marc()
    else:
        skc_sysno, skc_record = find_skc_sysno_and_marc(mzk_record)
        if skc_sysno is not None:
            catalog_record.skc_sysno = skc_sysno
            catalog_record.skc_marc = skc_record.as_marc()

    if catalog_record.cnb_sysno is not None:
        cnb_record = get_cnb_client().get_record(catalog_record.cnb_sysno)
        if catalog_record.cnb_record is not None and cnb_record is None:
            raise Exception(f"CNB record {catalog_record.cnb_sysno} not found")
        catalog_record.cnb_marc = cnb_record.as_marc()
    else:
        cnb_sysno, cnb_record = find_cnb_sysno_and_marc(mzk_record)
        if cnb_sysno is not None:
            catalog_record.cnb_sysno = cnb_sysno
            catalog_record.cnb_marc = cnb_record.as_marc()

    catalog_record.save(session)

    old_barcodes = set(catalog_record.barcodes)
    new_barcodes = {
        issue.barcode
        for issue in AlephMzkIssue.from_record(mzk_record.record)
        if issue.barcode is not None
    }

    for barcode in old_barcodes - new_barcodes:
        CatalogRecordBarcode.find(
            session, (catalog_record.sysno, barcode)
        ).delete(session)

    for barcode in new_barcodes - old_barcodes:
        CatalogRecordBarcode(sysno=catalog_record.sysno, barcode=barcode).save(
            session
        )

    update_catalog_record_differences(session, catalog_record)

    IndexCatalogRecord.model_validate(catalog_record).save(es_session)

    return catalog_record
