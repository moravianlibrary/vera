import requests
from lxml import etree
import re
from documents.schemas import Identifier
from documents.enums import IdentifierType
from catalogs.enums import DocumentCreateResult
from catalogs.aleph_document import CatalogDocument


ALEPH_ENDPOINT = "http://aleph.mzk.cz/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"

NS_0 = {"ns0": "http://www.openarchives.org/OAI/2.0/"}

SYSNO_FORMAT_1 = r'^\d{9}$'
SYSNO_FORMAT_2 = r'^(?:MZK|mzk)(\d{2})-?(\d{9})$'
SYSNO_BASES = ["MZK01", "MZK03"]


def parse_sysno(sysno: str):
    if re.match(SYSNO_FORMAT_1, sysno):
        return f"{SYSNO_BASES[0]}-{sysno}"
    formatted = re.sub(SYSNO_FORMAT_2, r'MZK\1-\2', sysno)
    base = formatted.split("-")[0]
    if base in SYSNO_BASES:
        return formatted


def generate_document_by_sysno(sysno: str):
    marc = download_from_catalog(sysno)
    if marc.find(".//ns0:error", namespaces=NS_0) is not None:
        return None, DocumentCreateResult.DOCUMENT_NOT_FOUND_IN_CATALOG

    return CatalogDocument(sysno, marc).get_schema()


def download_from_catalog(sysno: str):
    response = None
    try:
        response = requests.get(ALEPH_ENDPOINT.format(SYSNO=sysno))
    except Exception as e:
        print(f"An error occurred: {e}")

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")

    return etree.fromstring(response.content)


def generate_document_by_identifier(identifier: Identifier):
    if identifier.identifier_type == IdentifierType.SYSNO:
        if (not re.match(SYSNO_FORMAT_1, identifier.value)
                and not re.match(SYSNO_FORMAT_2, identifier.value)):
            return None, DocumentCreateResult.INVALID_SYSNO
        sysno = parse_sysno(identifier.value)
        if sysno is None:
            return None, DocumentCreateResult.INVALID_SYSNO_BASE
        return generate_document_by_sysno(sysno)
