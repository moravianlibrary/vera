from time import sleep
from typing import Optional
import requests
from bs4 import BeautifulSoup

from catalogs.aleph_catalog.aleph_record import AlephRecord
from catalogs.nkp_catalog.parsers import (
    parse_skc_sysno_from_document,
    skc_html_marc21_to_marc21,
)

NKP_BASE = "https://aleph.nkp.cz"
CONN_TIMEOUT = 10

SKC_LOCAL_BASE = "skc"
CNB_LOCAL_BASE = "cnb"

FIND_CNB_CODE = "CNB"
FIND_ISXN_CODE = "ISN"

FIND_BY_CODE_AND_VALUE = (
    "{NKP_BASE}/F/?func=find-b&local_base={LOCAL_BASE}"
    "&find_code={FIND_CODE}&request={FIND_VALUE}"
)
GET_MARC21 = (
    "{NKP_BASE}/F/?func=direct&doc_number="
    "{SYSNO}&local_base={LOCAL_BASE}&format=001"
)

ISBN13_PATTERN = r"\b(?:\d{3}-\d{1,5}-\d{1,7}-\d{1,8}-\d{1}|\d{13})\b"
ISBN_PATTERN = r"\b(?:\d{3}-\d{1,5}-\d{1,7}-\d{1,8}-\d{1}|\d{13}|\d{9}[\dX])\b"


class NkpCatalogClient:
    def find_document_by_cnb(self, cnb: str, local_base: str):
        response = requests.get(
            FIND_BY_CODE_AND_VALUE.format(
                NKP_BASE=NKP_BASE,
                LOCAL_BASE=local_base,
                FIND_CODE=FIND_CNB_CODE,
                FIND_VALUE=cnb,
            ),
            timeout=CONN_TIMEOUT,
        )

        if response.status_code != 200:
            return None
        return BeautifulSoup(response.content, "html.parser")

    def find_document_by_isxn(self, isxn: str, local_base: str):
        response = requests.get(
            FIND_BY_CODE_AND_VALUE.format(
                NKP_BASE=NKP_BASE,
                LOCAL_BASE=local_base,
                FIND_CODE=FIND_ISXN_CODE,
                FIND_VALUE=isxn,
            ),
            timeout=CONN_TIMEOUT,
        )

        if response.status_code != 200:
            print(response)
            return None
        return BeautifulSoup(response.content, "html.parser")

    def has_multiple_results(self, document: BeautifulSoup):
        return len(document.find_all("table", id="short_table")) > 0

    def parse_multiple_results(self, results: BeautifulSoup):
        results_table = results.find_all("table", id="short_table")

        links = []

        for row in results_table[0].find_all("tr")[1:]:
            cols = row.find_all("td")
            if len([col for col in cols if "BOA001" in col.text]) > 0:
                links.extend([a["href"] for a in row.find_all("a")])

        if len(links) != 1:
            return None

        response = requests.get(links[0], timeout=CONN_TIMEOUT)
        if response.status_code != 200:
            return None
        return BeautifulSoup(response.content, "html.parser")

    def find_nkp_sysno(
        self,
        cnb: Optional[str],
        isxn: Optional[str],
        local_base: str,
        retry: int = 0,
    ) -> Optional[str]:
        document = (cnb and self.find_document_by_cnb(cnb, local_base)) or (
            isxn and self.find_document_by_isxn(isxn, local_base)
        )
        if document is None:
            return None

        if self.has_multiple_results(document):
            document = self.parse_multiple_results(document)

        skc_sysno = parse_skc_sysno_from_document(document)
        if skc_sysno is None:
            if retry < 3:
                return self.find_nkp_sysno(cnb, isxn, local_base, retry + 1)
            sleep(10)
            return None
        return skc_sysno

    def get_marc21(self, sysno: str, local_base: str) -> Optional[str]:
        response = requests.get(
            GET_MARC21.format(
                NKP_BASE=NKP_BASE, LOCAL_BASE=local_base, SYSNO=sysno
            ),
            timeout=CONN_TIMEOUT,
        )
        if response.status_code != 200:
            return None

        html_marc21 = BeautifulSoup(response.content, "html.parser")
        return (
            skc_html_marc21_to_marc21(html_marc21)[1] if html_marc21 else None
        )

    def get_record(
        self,
        cnb: Optional[str],
        isxn: Optional[str],
        local_base: str,
    ) -> Optional[AlephRecord]:
        sysno = self.find_nkp_sysno(cnb, isxn, local_base)
        return (
            AlephRecord(sysno, self.get_marc21(sysno, local_base))
            if sysno
            else None
        )

    def get_skc_record(self, cnb: Optional[str], isxn: Optional[str]):
        return self.get_record(cnb, isxn, SKC_LOCAL_BASE)

    def get_cnb_record(self, cnb: Optional[str], isxn: Optional[str]):
        return self.get_record(cnb, isxn, CNB_LOCAL_BASE)


nkpCatalogClient = NkpCatalogClient()
