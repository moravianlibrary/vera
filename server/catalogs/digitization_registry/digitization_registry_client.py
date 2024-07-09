import requests
from typing import Generator, List, Optional

from catalogs.digitization_registry.registry_record import (
    DigitizationRegistryRecord,
)


PAGINATE_PAGE_SIZE = 10
REGISTER_SEARCH_ENDPOINT = (
    "https://registrdigitalizace.cz/rdcz/search/rdcz/"
    "select?q={QUERY}&start={START}&rows={ROWS}"
)


class DigitizationRegistryClient:
    def get_query_records(
        self, query: str
    ) -> Generator[DigitizationRegistryRecord, None, None]:
        start = 0
        while True:
            response = requests.get(
                REGISTER_SEARCH_ENDPOINT.format(
                    QUERY=query, START=start, ROWS=PAGINATE_PAGE_SIZE
                )
            )

            if response.status_code != 200:
                raise Exception(
                    f"Request failed with status code {response.status_code}"
                )

            response_data = response.json()["response"]
            num_found = response_data["numFound"]
            documents = response_data["docs"]

            for document in documents:
                yield DigitizationRegistryRecord(document)

            start += PAGINATE_PAGE_SIZE
            if start >= num_found:
                break

    def get_record_by_id(
        self, record_id: str
    ) -> Optional[DigitizationRegistryRecord]:
        documents: List[DigitizationRegistryRecord] = list(
            self.get_query_records(f'id:"{record_id}"')
        )
        if len(documents) != 1:
            return None
        return documents[0]

    def get_record_by_barcode(
        self, barcode: str
    ) -> Optional[DigitizationRegistryRecord]:
        documents: List[DigitizationRegistryRecord] = list(
            self.get_query_records(f'carkod:"{barcode}"')
        )
        if len(documents) != 1:
            return None
        return documents[0]

    def get_record_by_volume(
        self,
        query: str,
        year: Optional[str],
        volume: Optional[str],
        bundle: Optional[str],
    ) -> Optional[DigitizationRegistryRecord]:
        for document in self.get_query_records(query):
            if (
                (year is None or year == document.year)
                and (volume is None or volume == document.volume)
                and (bundle is None or bundle == document.bundle)
            ):
                return document
        return None

    def get_record(
        self,
        barcode: Optional[str] = None,
        cnb: Optional[str] = None,
        isxn: Optional[str] = None,
        year: Optional[str] = None,
        volume: Optional[str] = None,
        bundle: Optional[str] = None,
    ) -> Optional[DigitizationRegistryRecord]:
        if barcode:
            document = self.get_record_by_barcode(barcode)
            if document:
                return document

        if cnb:
            document = self.get_record_by_volume(
                (f'ccnb:"{cnb}"'), year, volume, bundle
            )
            if document:
                return document

        if isxn:
            return self.get_record_by_volume(
                (f'isxn:"{isxn}"'), year, volume, bundle
            )

        return None


client = DigitizationRegistryClient()

GetDigitizationRegistryRecord = client.get_record
GetDigitizationRegistryRecordById = client.get_record_by_id
