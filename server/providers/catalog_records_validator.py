from catalogs.knihovny_cz.knihovny_cz_client import KnihovnyCzClient
from catalogs.knihovny_cz.knihovny_cz_document import KnihovnyCzDocument
from catalogs.knihovny_cz.knihovny_cz_types import (
    KnihovnyCzField,
    LibraryPrefix,
)
from catalogs.nkp_catalog.nkp_catalog_client import (
    get_sysno_marc21,
    CNB_LOCAL_BASE,
)
from catalogs.aleph_api import get_marc21_document
from providers.catalog_records_comparator import (
    compare_marc21_records,
    calculate_records_similarity,
    Marc21Diff,
)
from pymarc import Record
from typing import List, Optional
from cachetools import TTLCache


VALID_CNB_SIMILARITY_THRESHOLD = 0.5


class CatalogRecordsValidator:
    def __init__(self) -> None:
        self.knihovny_cz_client = KnihovnyCzClient()
        self.cache = TTLCache(maxsize=25, ttl=3600)

    def get_skc_document(self, mzk_sysno: str) -> KnihovnyCzDocument:
        if mzk_sysno in self.cache:
            return self.cache[mzk_sysno]
        mzk_document = self.knihovny_cz_client.get_knihovny_cz_document(
            f"{LibraryPrefix.MZK.value}.{mzk_sysno}",
            [KnihovnyCzField.PerLibraryIds],
        )
        for library_id in mzk_document.per_library_ids:
            if library_id.startswith(LibraryPrefix.SKC.value):
                print(library_id)
                skc_document = (
                    self.knihovny_cz_client.get_knihovny_cz_document(
                        library_id, [KnihovnyCzField.FullRecord]
                    )
                )
                if skc_document is not None:
                    self.cache[mzk_sysno] = skc_document
                    return skc_document
        return None

    def has_valid_cnb(self, mzk_sysno: str, cnb: str) -> bool:
        skc_document = self.get_skc_document(mzk_sysno)
        if skc_document is not None:
            skc_cnb_tag = skc_document.marc21.get("015")
            if skc_cnb_tag is not None and skc_cnb_tag["a"] == cnb:
                return True

        cnb_document = get_sysno_marc21(cnb, None, CNB_LOCAL_BASE)[1]
        if cnb_document is None:
            return False

        mzk_document = get_marc21_document(mzk_sysno)

        return VALID_CNB_SIMILARITY_THRESHOLD < calculate_records_similarity(
            mzk_document, cnb_document
        )

    def get_mzk_skc_similarity(self, mzk_sysno: str) -> float:
        skc_document = self.get_skc_document(mzk_sysno)
        if skc_document is None:
            return 0.0
        mzk_document = get_marc21_document(mzk_sysno)
        return calculate_records_similarity(mzk_document, skc_document.marc21)

    def get_record_diff_against_skc(
        self, mzk_sysno: str, mzk_document: Record
    ) -> Optional[List[Marc21Diff]]:
        skc_document = self.get_skc_document(mzk_sysno)
        if skc_document is None:
            return None
        return compare_marc21_records(mzk_document, skc_document.marc21)
