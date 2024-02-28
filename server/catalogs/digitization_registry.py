import requests
from typing import Optional

from catalogs.enums import DigitizationState, IdentifierType
from catalogs.schemas import Identifier


REGISTER_SEARCH_ENDPOINT = (
    "https://registrdigitalizace.cz/rdcz/search/rdcz/select?q={QUERY}"
)


def parse_state_str(state: str):
    if state == "dokončeno":
        return DigitizationState.Finished
    elif state == "zpracování":
        return DigitizationState.InProgress
    elif state == "plánováno":
        return DigitizationState.Planned
    return DigitizationState.NotDigitized


def reduce_func(x, y):
    if x == DigitizationState.Finished or y == DigitizationState.Finished:
        return DigitizationState.Finished
    if x == DigitizationState.InProgress or y == DigitizationState.InProgress:
        return DigitizationState.InProgress
    return DigitizationState.Planned


def get_state_by_query(query: str):
    response = requests.get(REGISTER_SEARCH_ENDPOINT.format(QUERY=query))

    if response.status_code != 200:
        return
    found_documents = response.json()

    if found_documents["response"]["numFound"] == 0:
        return DigitizationState.NotDigitized

    if found_documents["response"]["numFound"] > 1:
        return DigitizationState.NotDigitized
    return parse_state_str(found_documents["response"]["docs"][0]["stav"])
    # return reduce(
    #     reduce_func,
    #     (
    #         parse_state_str(doc["stav"])
    #         for doc in found_documents["response"]["docs"]
    #     ),
    # )


def get_state_by_identifier(identifier: Identifier):
    if identifier.identifier_type == IdentifierType.Barcode:
        return get_state_by_query(f'carkod:"{identifier.value}"')
    if identifier.identifier_type == IdentifierType.Cnb:
        return get_state_by_query(f'ccnb:"{identifier.value}"')


def get_digitization_state(barcode: Optional[str], cnb: Optional[str] = None):
    state = None
    if barcode:
        state = get_state_by_identifier(
            Identifier(identifier_type=IdentifierType.Barcode, value=barcode)
        )
    if cnb and (state is None or state == DigitizationState.NotDigitized):
        state = get_state_by_identifier(
            Identifier(identifier_type=IdentifierType.Cnb, value=cnb)
        )
    return state if state is not None else DigitizationState.NotDigitized
