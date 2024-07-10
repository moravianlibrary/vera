from typing import Optional, Tuple
from io import BytesIO
import re
import requests
from lxml import etree
from pymarc import marcxml
from .record import AlephRecord
from .types import AlephField, AlephResponseStatus, ISXN_FIELDS

ALEPH_BASE = "https://aleph.mzk.cz"

GET_RECORD_ENDPOINT = "{ALEPH_BASE}/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"
FIND_ENDPOINT = "{ALEPH_BASE}/X?op=find"
FIND_RESULT_SET_ENDPOINT = (
    "{ALEPH_BASE}/X?op=find&base={BASE}&code={CODE}&request={VALUE}"
)
FIND_RECORDS_ENDPOINT = "{ALEPH_BASE}/X?op=present\
    &set_number={SET_NUMBER}&set_entry={SET_ENTRY}"

SYSNO_BASES = ["MZK01", "MZK03", "MZK04"]

NS_0 = {"ns0": "http://www.openarchives.org/OAI/2.0/"}
MARC_NS = {"marc": "http://www.loc.gov/MARC21/slim"}

SYSNO_FORMAT_1 = r"^\d{1-9}$"
SYSNO_FORMAT_2 = r"^(?:MZK|mzk)(\d{2})-?(\d{9})$"


class AlephClient:
    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    def check_catalog_availability(self):
        try:
            response = requests.get(ALEPH_BASE, timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            print(f"An error occurred: {e}")
            return False

    def check_find_endpoint_availability(self):
        try:
            response = requests.get(
                FIND_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE),
                timeout=self.timeout,
            )
            return response.status_code == 200
        except Exception as e:
            print(f"An error occurred: {e}")
            return False

    def get_record(
        self, sysno: str
    ) -> Tuple[Optional[AlephRecord], AlephResponseStatus]:
        response = None
        try:
            response = requests.get(
                GET_RECORD_ENDPOINT.format(ALEPH_BASE=ALEPH_BASE, SYSNO=sysno),
                timeout=self.timeout,
            )
        except Exception as e:
            print(f"An error occurred: {e}")
            return None, AlephResponseStatus.AlephRequestFailed

        if response.status_code != 200:
            print(
                f"HTTP request failed with status code {response.status_code}"
            )
            if response.status_code == 404:
                return None, AlephResponseStatus.AlephNotAvailable
            return None, AlephResponseStatus.AlephRequestFailed

        content = etree.fromstring(response.content)

        if content is None:
            return None, AlephResponseStatus.AlephRequestFailed

        if content.find(".//ns0:error", namespaces=NS_0) is not None:
            return None, AlephResponseStatus.RecordNotFound

        if content.find(".//marc:record", namespaces=MARC_NS) is None:
            return None, AlephResponseStatus.RecordNotFound

        xml_marc = content.find(".//marc:record", namespaces=MARC_NS)
        marc_xml_bytes = etree.tostring(xml_marc)
        marc_xml_file_like = BytesIO(marc_xml_bytes)
        record = marcxml.parse_xml_to_array(marc_xml_file_like)[0]

        return AlephRecord(sysno, record), AlephResponseStatus.Success

    def find_sysno(
        self, field: AlephField, value: str
    ) -> Tuple[Optional[str], AlephResponseStatus]:
        for base in SYSNO_BASES:
            request_url = FIND_RESULT_SET_ENDPOINT.format(
                ALEPH_BASE=ALEPH_BASE, BASE=base, CODE=field.value, VALUE=value
            )

            try:
                response = requests.get(request_url, timeout=self.timeout)
                if response.status_code != 200:
                    if response.status_code == 404:
                        return None, AlephResponseStatus.AlephNotAvailable
                    return None, AlephResponseStatus.AlephRequestFailed

                find = etree.fromstring(response.content)
                if find.find(".//error") is not None:
                    return None, AlephResponseStatus.RecordNotFound

                no_records_tag = find.find(".//no_records")
                if no_records_tag is None:
                    return None, AlephResponseStatus.RecordNotFound

                records_count = int(no_records_tag.text)

                if records_count == 0:
                    return None, AlephResponseStatus.RecordNotFound
                if records_count > 1:
                    return None, AlephResponseStatus.MultipleRecordsFound

                set_number = find.find(".//set_number").text

                response = requests.get(
                    FIND_RECORDS_ENDPOINT.format(
                        ALEPH_BASE=ALEPH_BASE,
                        SET_NUMBER=set_number,
                        SET_ENTRY="1",
                    ),
                    timeout=self.timeout,
                )
                if response.status_code != 200:
                    return None, AlephResponseStatus.AlephRequestFailed

                result = etree.fromstring(response.content)
                return (
                    result.find(".//doc_number").text,
                    AlephResponseStatus.Success,
                )
            except Exception as e:
                print(f"An error occurred: {e}")

    def find_record(
        self, field: AlephField, value: str
    ) -> Tuple[Optional[AlephRecord], AlephResponseStatus]:
        if field == AlephField.Sysno:
            if re.match(SYSNO_FORMAT_1, value):
                sysno, status = self.find_sysno(
                    AlephField.Sysno, value.zfill(9)
                )
            elif re.match(SYSNO_FORMAT_2, value):
                sysno = re.sub(SYSNO_FORMAT_2, r"MZK\1-\2", value)
                base = sysno.split("-")[0]
                if base not in SYSNO_BASES:
                    return None, AlephResponseStatus.InvalidSysnoBase
                status = AlephResponseStatus.Success
            else:
                return None, AlephResponseStatus.InvalidSysno
        elif field == AlephField.ISXN:
            for isxn_field in ISXN_FIELDS:
                sysno, status = self.find_sysno(isxn_field, value)
                if sysno is not None and status == AlephResponseStatus.Success:
                    break
        else:
            sysno, status = self.find_sysno(field, value)

        if status != AlephResponseStatus.Success:
            return None, status

        if sysno is None:
            return None, AlephResponseStatus.RecordNotFound

        return self.get_record(sysno)
