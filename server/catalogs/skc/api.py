import requests
from bs4 import BeautifulSoup
from pymarc import Record
from time import sleep
from typing import Optional, Tuple

from catalogs.skc.parsers import (
    parse_skc_sysno_from_document,
    skc_html_marc21_to_marc21,
)

SKC_BASE = "https://aleph.nkp.cz"
FIND_BY_CNB = (
    "{SKC_BASE}/F/?func=find-b&local_base=skc&find_code=CNB&request={CNB}"
)
FIND_BY_ISN = (
    "{SKC_BASE}/F/?func=find-b&local_base=skc&find_code=ISN&request={ISN}"
)
GET_MARC21 = (
    "{SKC_BASE}/F/?func=direct&doc_number={SYSNO}&local_base=SKC&format=001"
)

ISBN13_PATTERN = r"\b(?:\d{3}-\d{1,5}-\d{1,7}-\d{1,8}-\d{1}|\d{13})\b"
ISBN_PATTERN = r"\b(?:\d{3}-\d{1,5}-\d{1,7}-\d{1,8}-\d{1}|\d{13}|\d{9}[\dX])\b"


def find_document_by_cnb(cnb: str):
    response = requests.get(FIND_BY_CNB.format(SKC_BASE=SKC_BASE, CNB=cnb))

    if response.status_code != 200:
        return None
    return BeautifulSoup(response.content, "html.parser")


def find_document_by_isn(isn: str):
    response = requests.get(FIND_BY_ISN.format(SKC_BASE=SKC_BASE, ISN=isn))
    if response.status_code != 200:
        print(response)
        return None
    return BeautifulSoup(response.content, "html.parser")


def has_multiple_results(document: BeautifulSoup):
    return len(document.find_all("table", id="short_table")) > 0


def parse_multiple_results(results: BeautifulSoup):
    results_table = results.find_all("table", id="short_table")

    links = []

    for row in results_table[0].find_all("tr")[1:]:
        cols = row.find_all("td")
        if len([col for col in cols if "BOA001" in col.text]) > 0:
            links.extend([a["href"] for a in row.find_all("a")])

    if len(links) != 1:
        return None

    response = requests.get(links[0])
    if response.status_code != 200:
        return None
    return BeautifulSoup(response.content, "html.parser")


def find_skc_sysno(
    cnb: Optional[str], isn: Optional[str], retry: int = 0
) -> Optional[str]:
    document = (cnb and find_document_by_cnb(cnb)) or (
        isn and find_document_by_isn(isn)
    )
    if document is None:
        return None

    if has_multiple_results(document):
        document = parse_multiple_results(document)

    skc_sysno = parse_skc_sysno_from_document(document)
    if skc_sysno is None:
        if retry < 3:
            return find_skc_sysno(cnb, isn, retry + 1)
        sleep(10)
        return None
    return skc_sysno


def get_sysno_marc21(
    cnb: Optional[str], isn: Optional[str]
) -> Tuple[Optional[str], Optional[Record]]:
    sysno = find_skc_sysno(cnb, isn)
    if sysno is None:
        return None, None

    response = requests.get(GET_MARC21.format(SKC_BASE=SKC_BASE, SYSNO=sysno))
    if response.status_code != 200:
        return None, None

    html_marc21 = BeautifulSoup(response.content, "html.parser")
    return (
        skc_html_marc21_to_marc21(html_marc21) if html_marc21 else (None, None)
    )
