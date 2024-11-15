from typing import Optional, Tuple
from mzk_aleph import AlephMzkRecord
from pymarc import Record
from dispatchers import get_skc_client, get_cnb_client
from services.external.knihovny_cz import (
    KnihovnyCzClient,
    KnihovnyCzField,
    LibraryPrefix,
)


def find_skc_sysno_and_marc(
    mzk_record: AlephMzkRecord,
) -> Tuple[Optional[str], Optional[Record]]:
    skc_client = get_skc_client()
    kcz_client = KnihovnyCzClient()

    kcz_record = kcz_client.get_record(
        LibraryPrefix.MZK, mzk_record.sysno, [KnihovnyCzField.PerLibraryIds]
    )
    if kcz_record is not None and kcz_record.skc_sysno is not None:
        skc_record = skc_client.get_record(kcz_record.skc_sysno)
        if skc_record is not None:
            return kcz_record.skc_sysno, skc_record

    skc_record = skc_client.find_record_by_mzk_control_number(
        mzk_record.control_number
    )
    if skc_record is not None:
        return skc_client.parse_sysno(skc_record), skc_record

    skc_records = skc_client.find_by_identifiers(
        mzk_record.isbn, mzk_record.issn, mzk_record.cnb
    )
    if len(skc_records) == 1:
        return skc_client.parse_sysno(skc_records[0]), skc_records[0]

    return None, None


def find_cnb_sysno_and_marc(
    mzk_record: AlephMzkRecord,
) -> Tuple[Optional[str], Optional[Record]]:
    cnb_client = get_cnb_client()

    if mzk_record.cnb is not None:
        cnb_record = cnb_client.get_record(mzk_record.cnb.replace("cnb", ""))
        if cnb_record is not None:
            return cnb_client.parse_sysno(cnb_record), cnb_record

    cnb_records = cnb_client.find_by_identifiers(
        mzk_record.isbn, mzk_record.issn, mzk_record.cnb
    )
    if len(cnb_records) == 1:
        return cnb_client.parse_sysno(cnb_records[0]), cnb_records[0]

    return None, None
