import requests
from pymarc import marcxml, Record
from io import BytesIO


KNIHOVNY_CZ_URL = "https://www.knihovny.cz/api/v1"

GET_SKC_RECORD_ENDPOINT = (
    "{KNIHOVNY_CZ_URL}/record?id=caslin.{SYSNO}&field%5B%5D=fullRecord"
)
GET_ALTERNATIVE_IDS_ENDPOINT = (
    "{KNIHOVNY_CZ_URL}/record?id={SYSNO}&field%5B%5D=dedupIds"
)


class KnihovnyCzClient:
    def __init__(self) -> None:
        self.session = requests.Session()

    def get_skc_record(self, sysno) -> Record:
        response = self.session.get(
            GET_SKC_RECORD_ENDPOINT.format(
                KNIHOVNY_CZ_URL=KNIHOVNY_CZ_URL, SYSNO=sysno
            )
        )
        response.raise_for_status()

        records = response.json()["records"]
        if len(records) == 0:
            raise ValueError(f"Record with sysno {sysno} not found")
        if len(records) > 1:
            raise ValueError(f"Record with sysno {sysno} found more than once")

        xml_string = records[0]["fullRecord"]
        return marcxml.parse_xml_to_array(BytesIO(xml_string.encode("utf-8")))[
            0
        ]

    def get_mzk_sysno(self, sysno):
        response = self.session.get(
            GET_ALTERNATIVE_IDS_ENDPOINT.format(
                KNIHOVNY_CZ_URL=KNIHOVNY_CZ_URL, SYSNO=sysno
            )
        )
        response.raise_for_status()

        records = response.json()["records"]
        if len(records) == 0:
            raise ValueError(f"Record with sysno {sysno} not found")
        if len(records) > 1:
            raise ValueError(f"Record with sysno {sysno} found more than once")

        ids = records[0]["dedupIds"]
        for id in ids:
            if id.startswith("mzk."):
                return id.split(".")[1]
        return None
