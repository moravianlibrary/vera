# from pymarc import Record
# from typing import Optional
# from cachetools import TTLCache
# from catalogs.knihovny_cz.knihovny_cz_client import KnihovnyCzClient
# from catalogs.knihovny_cz.knihovny_cz_document import KnihovnyCzDocument
# from catalogs.knihovny_cz.knihovny_cz_types import (
#     KnihovnyCzField,
#     LibraryPrefix,
# )
# from providers.catalog_records_comparator import (
#     compare_marc21_records,
#     calculate_records_similarity,
#     Marc21DiffRecord,
# )


# VALID_CNB_SIMILARITY_THRESHOLD = 0.5


# class CatalogRecordsValidator:
#     def __init__(self) -> None:
#         self.knihovny_cz_client = KnihovnyCzClient()
#         self.cache = TTLCache(maxsize=50, ttl=3600)

#     def get_skc_document_by_mzk_sysno(
#         self, mzk_sysno: str
#     ) -> KnihovnyCzDocument:
#         if mzk_sysno in self.cache:
#             return self.cache[mzk_sysno]

#         skc_sysno = self.get_skc_sysno_by_mzk_sysno(mzk_sysno)

#         if skc_sysno is None:
#             return None

#         skc_document = self.get_skc_document(skc_sysno)

#         if skc_document is None:
#             return None

#         self.cache[mzk_sysno] = skc_document
#         return skc_document

#     def get_cnb_validity_score(self, mzk_sysno: str, cnb: str) -> float:
#         cnb_document = get_sysno_marc21(cnb, None, CNB_LOCAL_BASE)[1]
#         if cnb_document is None:
#             return 0.0

#         mzk_document = get_marc21_document(mzk_sysno)

#         return calculate_records_similarity(mzk_document, cnb_document)

#     def has_valid_cnb(self, mzk_sysno: str, cnb: str) -> bool:
#         return VALID_CNB_SIMILARITY_THRESHOLD < self.get_cnb_validity_score(
#             mzk_sysno, cnb
#         )

#     def get_mzk_skc_similarity(self, mzk_sysno: str) -> float:
#         skc_document = self.get_skc_document_by_mzk_sysno(mzk_sysno)
#         if skc_document is None:
#             return 0.0
#         mzk_document = get_marc21_document(mzk_sysno)
#         return calculate_records_similarity(mzk_document, skc_document)

#     def get_record_diff_against_skc(
#         self, mzk_sysno: str, mzk_document: Record
#     ) -> Optional[Marc21DiffRecord]:
#         skc_sysno = self.get_skc_sysno_by_mzk_sysno(mzk_sysno)

#         if skc_sysno is None:
#             return None

#         skc_document = self.get_skc_document(skc_sysno)

#         if skc_document is None:
#             return None

#         return compare_marc21_records(
#             mzk_sysno, mzk_document, skc_sysno, skc_document
#         )

#     def get_record_diff_against_cnb(
#         self, mzk_sysno: str, mzk_document: Record
#     ) -> Optional[Marc21DiffRecord]:
#         values = [
#             subfield_value
#             for field in mzk_document.get_fields("015")
#             for subfield_value in field.get_subfields("a")
#             if subfield_value is not None
#         ]

#         if len(values) != 1:
#             return None

#         cnb_sysno, cnb_document = get_sysno_marc21(
#             values[0], None, CNB_LOCAL_BASE
#         )

#         if cnb_sysno is None or cnb_document is None:
#             return None

#         return compare_marc21_records(
#             mzk_sysno, mzk_document, cnb_sysno, cnb_document
#         )
