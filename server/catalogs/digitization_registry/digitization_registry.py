import requests
from typing import Generator, List, Optional

from catalogs.enums import DigitizationState
from catalogs.digitization_registry.registry_document import RegistryDocument


PAGINATE_PAGE_SIZE = 10
REGISTER_SEARCH_ENDPOINT = (
    "https://registrdigitalizace.cz/rdcz/search/rdcz/"
    "select?q={QUERY}&start={START}&rows={ROWS}"
)


class DigitizationRegistryClient:
    def get_query_documents(
        self, query: str
    ) -> Generator[RegistryDocument, None, None]:
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
                yield RegistryDocument(document)

            start += PAGINATE_PAGE_SIZE
            if start >= num_found:
                break

    def get_state_for_volume(
        self,
        query: str,
        year: Optional[str],
        volume: Optional[str],
        bundle: Optional[str],
    ) -> DigitizationState:
        for document in self.get_query_documents(query):
            if (
                (year is None or year == document.year)
                and (volume is None or volume == document.volume)
                and (bundle is None or bundle == document.bundle)
            ):
                return document.digitization_state
        return DigitizationState.NotDigitized

    def get_state_for_document(self, barcode: str) -> DigitizationState:
        documents: List[RegistryDocument] = list(
            self.get_query_documents(f'carkod:"{barcode}"')
        )
        if len(documents) != 1:
            return DigitizationState.NotDigitized
        return documents[0].digitization_state

    def get_digitization_state(
        self,
        barcode: Optional[str] = None,
        cnb: Optional[str] = None,
        isxn: Optional[str] = None,
        year: Optional[str] = None,
        volume: Optional[str] = None,
        bundle: Optional[str] = None,
    ) -> DigitizationState:
        state = DigitizationState.NotDigitized
        if barcode:
            state = self.get_state_for_document(barcode)
            if state != DigitizationState.NotDigitized:
                return state

        if cnb:
            state = self.get_state_for_volume(
                (f'ccnb:"{cnb}"'), year, volume, bundle
            )
            if state != DigitizationState.NotDigitized:
                return state

        if isxn:
            return self.get_state_for_volume(
                (f'isxn:"{isxn}"'), year, volume, bundle
            )

        return DigitizationState.NotDigitized


digitization_registry = DigitizationRegistryClient()

DigitizationRegistry = digitization_registry.get_digitization_state
