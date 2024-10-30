import re
from pymarc import Record, Field
from typing import Optional, Tuple
from time import sleep
import requests
from bs4 import BeautifulSoup
from services.external.aleph import AlephRecord

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

SYSNO_PATTERN = r"doc_no\s*=\s*\"(.*?)\""
MARC21_LEADER = "LDR"
MARC21_SYSNO = "SYS"
MARC21_FORMAT = "FMT"
MARC21_TAG_PATTERN = r"(\d{3})"


class NkpAlephClient:
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

    def parse_skc_sysno_from_document(
        self,
        document: BeautifulSoup,
    ) -> Optional[str]:
        document_str = str(document)
        match = re.search(SYSNO_PATTERN, document_str)
        return match.group(1) if match else None

    def find_nkp_sysno(
        self,
        cnb: Optional[str],
        isxn: Optional[str],
        local_base: str,
        retry: int = 3,
    ) -> Optional[str]:
        document = (cnb and self.find_document_by_cnb(cnb, local_base)) or (
            isxn and self.find_document_by_isxn(isxn, local_base)
        )
        if document is None:
            return None

        if self.has_multiple_results(document):
            document = self.parse_multiple_results(document)

        skc_sysno = self.parse_skc_sysno_from_document(document)
        if skc_sysno is None and retry > 0:
            sleep(10)
            return self.find_nkp_sysno(cnb, isxn, local_base, retry - 1)
        return skc_sysno

    def skc_html_marc21_to_marc21(
        self,
        document: BeautifulSoup,
    ) -> Optional[Tuple[str, Record]]:
        record_table = document.find("table", id="record")
        if record_table is None:
            return None, None

        sysno, record = None, Record()

        for row in record_table.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) != 2:
                raise ValueError

            field_text = cols[0].text.strip()
            values_text = cols[1].text.strip()

            if field_text == MARC21_LEADER:
                record.leader = values_text
            elif field_text == MARC21_SYSNO:
                sysno = values_text
            elif field_text == MARC21_FORMAT:
                continue
            elif not re.match(MARC21_TAG_PATTERN, field_text):
                # raise ValueError(field_text)
                continue

            # If is control field
            elif not values_text.startswith("|"):
                field = Field(tag=field_text, data=values_text)
                record.add_field(field)

            # If is data field
            else:
                datafield = field_text

                subfields = re.split(r"(?<!\|)\|(?!\|)", values_text)[1:]

                tag = datafield[0:3]
                ind1 = datafield[3] if len(datafield) > 3 else " "
                ind2 = datafield[4] if len(datafield) > 4 else " "

                field = Field(tag=tag, indicators=[ind1, ind2])

                for subfield in subfields:
                    code = subfield[0]
                    value = subfield[1:]
                    field.add_subfield(code, value)

                record.add_field(field)

        return sysno, record

    def get_marc21(
        self, sysno: str, local_base: str, retry: int = 3
    ) -> Optional[Record]:
        response = requests.get(
            GET_MARC21.format(
                NKP_BASE=NKP_BASE, LOCAL_BASE=local_base, SYSNO=sysno
            ),
            timeout=CONN_TIMEOUT,
        )
        if response.status_code != 200:
            return None

        html_marc21 = BeautifulSoup(response.content, "html.parser")
        if not html_marc21:
            return None

        record = self.skc_html_marc21_to_marc21(html_marc21)[1]
        if not record and retry > 0:
            sleep(2)
            return self.get_marc21(sysno, local_base, retry - 1)

        return record

    def get_record(
        self,
        cnb: Optional[str],
        isxn: Optional[str],
        local_base: str,
    ) -> Optional[AlephRecord]:
        sysno = self.find_nkp_sysno(cnb, isxn, local_base)
        if sysno is None:
            return None
        record = self.get_marc21(sysno, local_base)
        return AlephRecord(sysno, record) if sysno else None

    def get_skc_record(
        self, cnb: Optional[str], isxn: Optional[str]
    ) -> Optional[AlephRecord]:
        return self.get_record(cnb, isxn, SKC_LOCAL_BASE)

    def get_cnb_record(
        self, cnb: Optional[str], isxn: Optional[str]
    ) -> Optional[AlephRecord]:
        return self.get_record(cnb, isxn, CNB_LOCAL_BASE)
