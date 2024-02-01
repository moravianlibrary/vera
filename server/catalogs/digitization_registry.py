import requests
from functools import reduce

from catalogs.enums import DigitizationState
from documents.schemas import Identifier
from documents.enums import IdentifierType


REGISTER_SEARCH_ENDPOINT = \
    "https://registrdigitalizace.cz/rdcz/search/rdcz/select?q={QUERY}"


def parse_state_str(state: str):
    if state == "dokončeno":
        return DigitizationState.FINISHED
    elif state == "zpracování":
        return DigitizationState.IN_PROGRESS
    elif state == "plánováno":
        return DigitizationState.PLANNED
    return DigitizationState.NOT_DIGITIZED


def reduce_func(x, y):
    if x == DigitizationState.FINISHED or y == DigitizationState.FINISHED:
        return DigitizationState.FINISHED
    if (x == DigitizationState.IN_PROGRESS
            or y == DigitizationState.IN_PROGRESS):
        return DigitizationState.IN_PROGRESS
    return DigitizationState.PLANNED


def get_state_by_query(query: str):
    response = requests.get(REGISTER_SEARCH_ENDPOINT.format(QUERY=query))

    if response.status_code != 200:
        return
    found_documents = response.json()

    if found_documents['response']['numFound'] == 0:
        return DigitizationState.NOT_DIGITIZED

    return reduce(reduce_func,
                  (parse_state_str(doc['stav'])
                   for doc in found_documents['response']['docs']))


def get_state_by_identifier(identifier: Identifier):
    if identifier.identifier_type == IdentifierType.BARCODE:
        return get_state_by_query(f'carkod:"{identifier.value}"')
    if identifier.identifier_type == IdentifierType.CCNB:
        return get_state_by_query(f'ccnb:"{identifier.value}"')
