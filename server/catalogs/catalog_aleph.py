import requests
from lxml import etree
import re
from documents.schemas import Identifier
from documents.enums import IdentifierType
from catalogs.enums import DocumentCreateResult
from catalogs.aleph_document import CatalogDocument


ALEPH_SYSNO_ENDPOINT = "https://aleph.mzk.cz/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"
ALEPH_FIND_BY_BARCODE_EDNPOINT = \
    "https://aleph.mzk.cz/X?op=find&base={BASE}&code=bc&request={BARCODE}"
ALEPH_FIND_BY_SIGNATURE_EDNPOINT = \
    "https://aleph.mzk.cz/X?op=find&base={BASE}&code=SIG&request={SIGNATURE}"
ALEPH_FIND_DOCUMENTS_ENDPOINT = "https://aleph.mzk.cz//X?op=present\
    &set_number={SET_NUMBER}&set_entry={SET_ENTRY}"

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
        response = requests.get(ALEPH_SYSNO_ENDPOINT.format(SYSNO=sysno))
    except Exception as e:
        print(f"An error occurred: {e}")

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")

    return etree.fromstring(response.content)


# TODO: raise exception if catalog is not available (403)
def find_sysno(request_url: str):
    try:
        response = requests.get(request_url)
        if response.status_code != 200:
            return None

        find = etree.fromstring(response.content)
        if find.find(".//error") is not None:
            return None, DocumentCreateResult.DOCUMENT_NOT_FOUND_IN_CATALOG

        records_count = int(find.find('.//no_records').text)
        if records_count != 1:
            return None
        set_number = find.find('.//set_number').text

        response = requests.get(ALEPH_FIND_DOCUMENTS_ENDPOINT
                                .format(SET_NUMBER=set_number, SET_ENTRY="1"))
        if response.status_code != 200:
            return None

        result = etree.fromstring(response.content)
        return result.find('.//doc_number').text
    except Exception as e:
        print(f"An error occurred: {e}")


def find_sysno_by_barcode(barcode: str):
    for base in SYSNO_BASES:
        sysno = find_sysno(ALEPH_FIND_BY_BARCODE_EDNPOINT
                           .format(BASE=base, BARCODE=barcode))
        if sysno is not None:
            return f"{base}-{sysno}"


def find_sysno_by_signature(signature: str):
    for base in SYSNO_BASES:
        sysno = find_sysno(ALEPH_FIND_BY_SIGNATURE_EDNPOINT
                           .format(BASE=base, SIGNATURE=signature))
        if sysno is not None:
            return f"{base}-{sysno}"


def generate_document_by_identifier(identifier: Identifier):
    if identifier.identifier_type == IdentifierType.Sysno:
        if (not re.match(SYSNO_FORMAT_1, identifier.value)
                and not re.match(SYSNO_FORMAT_2, identifier.value)):
            return None, DocumentCreateResult.INVALID_SYSNO
        sysno = parse_sysno(identifier.value)
        if sysno is None:
            return None, DocumentCreateResult.INVALID_SYSNO_BASE
        return generate_document_by_sysno(sysno)
    if identifier.identifier_type == IdentifierType.Barcode:
        sysno = find_sysno_by_barcode(identifier.value)
        if sysno is None:
            return None, DocumentCreateResult.DOCUMENT_NOT_FOUND_IN_CATALOG
        return generate_document_by_sysno(sysno)
    if identifier.identifier_type == IdentifierType.Signature:
        sysno = find_sysno_by_signature(identifier.value)
        if sysno is None:
            return None, DocumentCreateResult.DOCUMENT_NOT_FOUND_IN_CATALOG
        return generate_document_by_sysno(sysno)

    return None, DocumentCreateResult.INVALID_IDENTIFIER
