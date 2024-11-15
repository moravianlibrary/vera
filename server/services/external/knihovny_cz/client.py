import requests
from typing import List, Optional
from .record import KnihovnyCzRecord
from .types import KnihovnyCzField, LibraryPrefix


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

    def get_record(
        self,
        library: LibraryPrefix,
        sysno: str,
        fields: List[KnihovnyCzField] = [],
    ) -> Optional[KnihovnyCzRecord]:
        url = GET_RECORD_ENDPOINT.format(
            KNIHOVNY_CZ_URL=KNIHOVNY_CZ_URL, SYSNO=f"{library.value}.{sysno}"
        )
        for field in fields:
            url += f"&field%5B%5D={field.value}"

        response = self.session.get(url)
        response.raise_for_status()

        records = response.json()["records"]
        if len(records) == 0:
            return None
        if len(records) > 1:
            raise ValueError(
                f"Record with id {library}.{sysno} found more than once"
            )

        record = records[0]
        return KnihovnyCzRecord(sysno, record)
