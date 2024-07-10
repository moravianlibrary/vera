from typing import Optional, Tuple
from crud.catalog_records import (
    save_catalog_record,
)
from sqlalchemy.orm import Session
from schemas.catalog_records import CatalogRecord
from services.external.aleph.client import AlephClient
from services.external.nkp_aleph.client import NkpAlephClient
from services.external.aleph.types import AlephResponseStatus


def update_catalog_record(
    session: Session, sysno: str
) -> Tuple[Optional[CatalogRecord], AlephResponseStatus]:
    main_aleph_record, aleph_response_status = AlephClient().get_record(sysno)

    if aleph_response_status != AlephResponseStatus.Success:
        return None, aleph_response_status

    skc_aleph_record = NkpAlephClient().get_skc_record(
        main_aleph_record.cnb, main_aleph_record.isxn
    )
    cnb_aleph_record = NkpAlephClient().get_cnb_record(
        main_aleph_record.cnb, main_aleph_record.isxn
    )

    skc_confidence = 0
    cnb_confidence = 0

    return (
        save_catalog_record(
            session,
            main_aleph_record,
            skc_aleph_record,
            skc_confidence,
            cnb_aleph_record,
            cnb_confidence,
        ),
        AlephResponseStatus.Success,
    )
