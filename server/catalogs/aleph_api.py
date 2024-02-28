import requests
from lxml import etree

from catalogs.aleph_document import AlephDocument

ALEPH_BASE = "https://aleph.mzk.cz"

GET_RECORD_ENDPOINT = "{ALEPH_BASE}/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"
FIND_EDNPOINT = "{ALEPH_BASE}/X?op=find"
FIND_BY_BARCODE_EDNPOINT = (
    "{ALEPH_BASE}/X?op=find&base={BASE}&code=BAR&request={BARCODE}"
)
FIND_BY_SIGNATURE_EDNPOINT = (
    "{ALEPH_BASE}/X?op=find&base={BASE}&code=SIG&request={SIGNATURE}"
)
FIND_DOCUMENTS_ENDPOINT = "{ALEPH_BASE}/X?op=present\
    &set_number={SET_NUMBER}&set_entry={SET_ENTRY}"

SYSNO_BASES = ["MZK01", "MZK03"]

NS_0 = {"ns0": "http://www.openarchives.org/OAI/2.0/"}
MARC_NS = {"marc": "http://www.loc.gov/MARC21/slim"}


def check_catalog_availability():
    try:
        response = requests.get(ALEPH_BASE)
        return response.status_code == 200
    except Exception as e:
        print(f"An error occurred: {e}")
        return False


def get_catalog_document(sysno: str):
    response = None
    try:
        response = requests.get(
            GET_RECORD_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE, SYSNO=sysno)
        )
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")
        return None

    content = etree.fromstring(response.content)

    if content.find(".//ns0:error", namespaces=NS_0) is not None:
        return None

    return AlephDocument(
        sysno, content.find(".//marc:record", namespaces=MARC_NS)
    )


def check_find_endpoint_availability():
    try:
        response = requests.get(FIND_EDNPOINT.format(ALEPH_BASE=ALEPH_BASE))
        return response.status_code == 200
    except Exception as e:
        print(f"An error occurred: {e}")
        return False


def find_sysno(request_url: str):
    try:
        response = requests.get(request_url)
        if response.status_code != 200:
            return None

        find = etree.fromstring(response.content)
        if find.find(".//error") is not None:
            return None

        records_count = int(find.find(".//no_records").text)
        if records_count != 1:
            return None
        set_number = find.find(".//set_number").text

        response = requests.get(
            FIND_DOCUMENTS_ENDPOINT.format(
                ALEPH_BASE=ALEPH_BASE, SET_NUMBER=set_number, SET_ENTRY="1"
            )
        )
        if response.status_code != 200:
            return None

        result = etree.fromstring(response.content)
        return result.find(".//doc_number").text
    except Exception as e:
        print(f"An error occurred: {e}")


def find_sysno_by_barcode(barcode: str):
    for base in SYSNO_BASES:
        sysno = find_sysno(
            FIND_BY_BARCODE_EDNPOINT.format(
                ALEPH_BASE=ALEPH_BASE, BASE=base, BARCODE=barcode
            )
        )
        if sysno is not None:
            return f"{base}-{sysno}"


def find_sysno_by_signature(signature: str):
    for base in SYSNO_BASES:
        sysno = find_sysno(
            FIND_BY_SIGNATURE_EDNPOINT.format(
                ALEPH_BASE=ALEPH_BASE, BASE=base, SIGNATURE=signature
            )
        )
        if sysno is not None:
            return f"{base}-{sysno}"
