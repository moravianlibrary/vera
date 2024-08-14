from typing import Optional, Tuple
from sqlalchemy.orm import Session
from services.external.aleph import AlephClient
from services.external.aleph import AlephResponseStatus
from services.external.nkp_aleph.client import NkpAlephClient
from models import CatalogRecord
from services.marc_records_comparator import (
    MarcRecordsComparator,
    MarcFieldsComparator,
    EditionFieldComparator,
    GeneralInformationComparator,
)


MzkSkcRecordsComparator = MarcRecordsComparator(
    {
        "008": GeneralInformationComparator(),
        "015": MarcFieldsComparator("015", subfield_codes=["a"]),
        "020": MarcFieldsComparator("020", subfield_codes=["a"]),
        "250": EditionFieldComparator(),
        "260": MarcFieldsComparator("260", subfield_codes=["a", "b", "c"]),
        "264": MarcFieldsComparator("264", subfield_codes=["a", "b", "c"]),
        "300": MarcFieldsComparator("300", subfield_codes=["a", "b", "c"]),
        "362": MarcFieldsComparator({"a": "Mzk Skc"}),
    }
)
MzkCnbRecordsComparator = MarcRecordsComparator(
    {
        "008": GeneralInformationComparator(),
        "015": MarcFieldsComparator("015", subfield_codes=["a"]),
        "020": MarcFieldsComparator("020", subfield_codes=["a"]),
    }
)


def update_catalog_record(
    session: Session, sysno: str
) -> Tuple[Optional[CatalogRecord], AlephResponseStatus]:
    main_aleph_record, aleph_response_status = AlephClient().get_record(sysno)

    if aleph_response_status != AlephResponseStatus.Success:
        return None, aleph_response_status

    catalog_record = CatalogRecord.find(session, sysno)
    if catalog_record is None:
        catalog_record = CatalogRecord(sysno=sysno)

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
        catalog_record.skc_diff = [
            diff.model_dump()
            for diff in MzkSkcRecordsComparator.evaluate(
                main_aleph_record.record, skc_aleph_record.record, True
            )
        ]

    cnb_aleph_record = NkpAlephClient().get_cnb_record(
        main_aleph_record.cnb, main_aleph_record.isxn
    )
    if cnb_aleph_record:
        catalog_record.cnb_sysno = cnb_aleph_record.sysno
        catalog_record.cnb_marc = cnb_aleph_record.record.as_marc()
        catalog_record.cnb_diff = [
            diff.model_dump()
            for diff in MzkCnbRecordsComparator.evaluate(
                main_aleph_record.record, cnb_aleph_record.record, True
            )
        ]

    return catalog_record.save(session), AlephResponseStatus.Success
