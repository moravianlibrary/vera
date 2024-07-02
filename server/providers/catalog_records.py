from catalogs.nkp_catalog.nkp_catalog_client import (
    get_sysno_marc21,
    get_marc21,
    CNB_LOCAL_BASE,
)
from catalogs.aleph_api import get_marc21_document
from providers.catalog_records_comparator import (
    compare_marc21_records,
    calculate_records_similarity,
    Marc21DiffRecord,
)
from pymarc import Record
from typing import Optional
from cachetools import TTLCache


mzk_records_cache = TTLCache(maxsize=25, ttl=3600)


def get_mzk_catalog_record(mzk_sysno: str) -> Optional[Record]:
    if mzk_sysno in mzk_records_cache:
        return mzk_records_cache[mzk_sysno]

    mzk_record = get_marc21_document(mzk_sysno)

    if mzk_record is None:
        return None

    mzk_records_cache[mzk_sysno] = mzk_record
    return mzk_record


def get_skc_sysno(mzk_record: Record) -> Optional[str]:
    pass


def get_cnb_sysno(cnb_sysno: str) -> Optional[str]:
    pass


def get_rd_id(cnb_sysno: str) -> Optional[str]:
    pass
