from typing import Optional, Tuple
from sqlalchemy.orm import Session
from services.external.aleph import AlephClient
from services.external.aleph import AlephResponseStatus
from services.external.nkp_aleph.client import NkpAlephClient
from models import CatalogRecord


def update_catalog_record(
    session: Session, sysno: str
) -> Tuple[Optional[CatalogRecord], AlephResponseStatus]:
    main_aleph_record, aleph_response_status = AlephClient().get_record(sysno)

    if aleph_response_status != AlephResponseStatus.Success:
        return None, aleph_response_status

    catalog_record = CatalogRecord.get(session, sysno)

    catalog_record.marc = main_aleph_record.record.as_marc()
    catalog_record.cnb = main_aleph_record.cnb
    catalog_record.signature = main_aleph_record.signature
    catalog_record.isxn = main_aleph_record.isxn

    skc_aleph_record = NkpAlephClient().get_skc_record(
        main_aleph_record.cnb, main_aleph_record.isxn
    )
    if skc_aleph_record:
        catalog_record.skc_sysno = skc_aleph_record.sysno
        catalog_record.skc_marc = skc_aleph_record.record.as_marc()
        catalog_record.skc_score = 0

    cnb_aleph_record = NkpAlephClient().get_cnb_record(
        main_aleph_record.cnb, main_aleph_record.isxn
    )
    if cnb_aleph_record:
        catalog_record.cnb_sysno = skc_aleph_record.sysno
        catalog_record.cnb_marc = skc_aleph_record.record.as_marc()
        catalog_record.cnb_score = 0

    return catalog_record.save(session), AlephResponseStatus.Success
