import requests
from typing import List, Optional
from catalogs.knihovny_cz.knihovny_cz_document import KnihovnyCzDocument
from catalogs.knihovny_cz.knihovny_cz_types import KnihovnyCzField


KNIHOVNY_CZ_URL = "https://www.knihovny.cz/api/v1"

GET_RECORD_ENDPOINT = "{KNIHOVNY_CZ_URL}/record?id={SYSNO}"
FIELDS_KEY = "fields"

GET_SKC_RECORD_ENDPOINT = (
    "{KNIHOVNY_CZ_URL}/record?id=caslin.{SYSNO}&field%5B%5D=fullRecord"
)
GET_ALTERNATIVE_IDS_ENDPOINT = (
    "{KNIHOVNY_CZ_URL}/record?id={SYSNO}&field%5B%5D=dedupIds"
)


class KnihovnyCzClient:
    def __init__(self) -> None:
        self.session = requests.Session()

    def get_knihovny_cz_document(
        self, sysno: str, fields: List[KnihovnyCzField] = []
    ) -> Optional[KnihovnyCzDocument]:
        url = GET_RECORD_ENDPOINT.format(
            KNIHOVNY_CZ_URL=KNIHOVNY_CZ_URL, SYSNO=sysno
        )
        for field in fields:
            url += f"&field%5B%5D={field.value}"

        response = self.session.get(url)
        response.raise_for_status()

        records = response.json()["records"]
        if len(records) == 0:
            return None
        if len(records) > 1:
            raise ValueError(f"Record with sysno {sysno} found more than once")

        record = records[0]
        return KnihovnyCzDocument(sysno, record)
