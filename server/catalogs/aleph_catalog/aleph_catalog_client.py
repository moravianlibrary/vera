from io import BytesIO
import requests
from lxml import etree
from pymarc import marcxml, Record
from typing import Optional
from enum import Enum

from catalogs.aleph_catalog.aleph_record import AlephRecord

ALEPH_BASE = "https://aleph.mzk.cz"

GET_RECORD_ENDPOINT = "{ALEPH_BASE}/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"
FIND_ENDPOINT = "{ALEPH_BASE}/X?op=find"
FIND_RESULTS_ENDPOINT = (
    "{ALEPH_BASE}/X?op=find&base={BASE}&code={CODE}&request={VALUE}"
)
FIND_RECORDS_ENDPOINT = "{ALEPH_BASE}/X?op=present\
    &set_number={SET_NUMBER}&set_entry={SET_ENTRY}"

SYSNO_BASES = ["MZK01", "MZK03"]

NS_0 = {"ns0": "http://www.openarchives.org/OAI/2.0/"}
MARC_NS = {"marc": "http://www.loc.gov/MARC21/slim"}

SYSNO_FORMAT_1 = r"^\d{1-9}$"
SYSNO_FORMAT_2 = r"^(?:MZK|mzk)(\d{2})-?(\d{9})$"


class AlephCatalogField(Enum):
    Sysno = "SYS"
    Barcode = "BAR"
    Signature = "SIG"
    ISXN = "ISN"


class AlephCatalogClient:
    def check_catalog_availability(self):
        try:
            response = requests.get(ALEPH_BASE)
            return response.status_code == 200
        except Exception as e:
            print(f"An error occurred: {e}")
            return False

    def check_find_endpoint_availability(self):
        try:
            response = requests.get(
                FIND_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE)
            )
            return response.status_code == 200
        except Exception as e:
            print(f"An error occurred: {e}")
            return False

    def get_marc21_document(self, sysno: str) -> Record:
        response = None
        try:
            response = requests.get(
                GET_RECORD_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE, SYSNO=sysno)
            )
        except Exception as e:
            print(f"An error occurred: {e}")
            return None

        if response.status_code != 200:
            print(
                f"HTTP request failed with status code {response.status_code}"
            )
            return None

        content = etree.fromstring(response.content)

        if content.find(".//ns0:error", namespaces=NS_0) is not None:
            return None

        xml_marc = content.find(".//marc:record", namespaces=MARC_NS)
        marc_xml_bytes = etree.tostring(xml_marc)
        marc_xml_file_like = BytesIO(marc_xml_bytes)
        return marcxml.parse_xml_to_array(marc_xml_file_like)[0]

    # TODO: Add error handling
    def get_catalog_record(self, sysno: str) -> AlephRecord:
        response = None
        try:
            response = requests.get(
                GET_RECORD_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE, SYSNO=sysno)
            )
        except Exception as e:
            print(f"An error occurred: {e}")
            return None

        if response.status_code != 200:
            print(
                f"HTTP request failed with status code {response.status_code}"
            )
            return None

        content = etree.fromstring(response.content)

        if content is None:
            return None

        if content.find(".//ns0:error", namespaces=NS_0) is not None:
            return None

        if content.find(".//marc:record", namespaces=MARC_NS) is None:
            return None

        xml_marc = content.find(".//marc:record", namespaces=MARC_NS)
        marc_xml_bytes = etree.tostring(xml_marc)
        marc_xml_file_like = BytesIO(marc_xml_bytes)
        record = marcxml.parse_xml_to_array(marc_xml_file_like)[0]

        return AlephRecord(sysno, record)

    def find_sysno(
        self, field: AlephCatalogField, value: str
    ) -> Optional[str]:
        for base in SYSNO_BASES:
            request_url = FIND_RESULTS_ENDPOINT.format(
                ALEPH_BASE=ALEPH_BASE, BASE=base, CODE=field.value, VALUE=value
            )

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
                    FIND_RECORDS_ENDPOINT.format(
                        ALEPH_BASE=ALEPH_BASE,
                        SET_NUMBER=set_number,
                        SET_ENTRY="1",
                    )
                )
                if response.status_code != 200:
                    return None

                result = etree.fromstring(response.content)
                return result.find(".//doc_number").text
            except Exception as e:
                print(f"An error occurred: {e}")

    def get_record(
        self,
        sysno: Optional[str],
        barcode: Optional[str],
        signature: Optional[str],
        isxn: Optional[str],
    ) -> AlephRecord:
        if sysno is not None and re.match(SYSNO_FORMAT_1, sysno):
            
        pass
