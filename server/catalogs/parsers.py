import re
from typing import Optional

from catalogs.aleph_document import AlephDocument, AlephIssue
from catalogs.digitization_registry import get_digitization_state
from catalogs.enums import (
    DigitizationState,
    MaterialType,
)
from catalogs.schemas import CatalogDocument, CatalogIssue, Frequency


MATERIAL_TYPE_MAPPING = {
    "BK": MaterialType.Book,
    "CR": MaterialType.ContinuingResource,
    "SE": MaterialType.ContinuingResource,
    "MP": MaterialType.Map,
    "MU": MaterialType.Music,
}

PAGE_COUNT_FORMAT = (
    r"^\s*(?:\[?(?:XC|xc|XL|xl|L?X{0,3}|l?x{0,3})"
    r"(?:IX|ix|IV|iv|V?I{0,3}|v?i{0,3})\]?\s*[,-]\s*)?"
    r"\[?(\d+)\]?\s*"
    r"(?:[,-]\s*\[?(?:\d+|(?:XC|xc|XL|xl|L?X{0,3}|l?x{0,3})"
    r"(?:IX|ix|IV|iv|V?I{0,3}|v?i{0,3}))\]?)?\s*"
    r"(s\.|l\.|stran).*"
)
VOLUME_PAGE_COUNTS_PATTERN = (
    r"^\s*\d+\s+(?:sv\.|svazky)\s+[\(\[]((?:\d+[,;]?\s+)+\s*s\.)[\)\]]"
)
VOLUME_NUMBER_PATTERNS = (
    r"^\s*(\d+)[.,]",
    r"(\d+)[.,]\s*$",
)
VOLUME_NUMBER_ROMANS_PATTERN = r"^\s*(IX|ix|IV|iv|V?I{0,3}|v?i{0,3})[.,]"
ROMAN_VALUES = {
    "I": 1,
    "V": 5,
    "X": 10,
    "L": 50,
    "C": 100,
}


def roman_to_int(roman: str):
    integer_value = 0
    for i in range(len(roman)):
        if (
            i + 1 < len(roman)
            and ROMAN_VALUES[roman[i]] < ROMAN_VALUES[roman[i + 1]]
        ):
            integer_value -= ROMAN_VALUES[roman[i]]
        else:
            integer_value += ROMAN_VALUES[roman[i]]
    return integer_value


def parse_page_count(
    extent: Optional[str], volume: Optional[str] = None
) -> Optional[int]:
    if extent is None:
        return None
    if volume is None:
        match = re.search(PAGE_COUNT_FORMAT, extent)
        return int(match.group(1)) if match else None

    match = re.search(VOLUME_NUMBER_ROMANS_PATTERN, volume)
    if match:
        number = roman_to_int(match.group(1)) - 1
    else:
        for pattern in VOLUME_NUMBER_PATTERNS:
            match = re.search(pattern, volume)
            if match:
                number = int(match.group(1)) - 1
                break
        else:
            return None

    match = re.match(VOLUME_PAGE_COUNTS_PATTERN, extent)
    if not match:
        return None
    inner_content = match.group(1)
    numbers = re.findall(r"\d+", inner_content)
    return int(numbers[number]) if 0 <= number < len(numbers) else None


def from_aleph_issue(
    aleph_issue: AlephIssue,
    digitization_state: DigitizationState,
) -> CatalogIssue:
    return CatalogIssue(
        type=aleph_issue.type,
        barcode=aleph_issue.barcode,
        signature=aleph_issue.signature,
        year=aleph_issue.year,
        volume=aleph_issue.volume,
        bundle=aleph_issue.bundle,
        digitization_state=digitization_state,
    )


def from_aleph_document(
    aleph_document: AlephDocument,
) -> CatalogDocument:

    one_issue = aleph_document.issues and len(aleph_document.issues) == 1
    issue = aleph_document.issues[0] if one_issue else None
    return CatalogDocument(
        sysno=aleph_document.sysno,
        volume=(issue.volume if one_issue else aleph_document.part_title),
        barcode=issue.barcode if one_issue else None,
        cnb=aleph_document.cnb,
        isbn_issn=aleph_document.isbn_issn,
        sigla=aleph_document.sigla,
        signature=aleph_document.signature,
        material_type=MATERIAL_TYPE_MAPPING.get(
            aleph_document.material_type, MaterialType.Other
        ),
        title=aleph_document.title,
        digitization_state=get_digitization_state(
            issue.barcode if one_issue else None, aleph_document.cnb
        ),
        year=issue.year if one_issue else None,
        bundle=issue.bundle if one_issue else None,
        pages_count=parse_page_count(aleph_document.extent),
        size=aleph_document.size,
        locationUri=aleph_document.locationUri,
        publishers=aleph_document.publishers,
        publishing_places=aleph_document.publishing_places,
        publisher=aleph_document.publisher,
        publishing_place=aleph_document.publishing_place,
        publishing_year=aleph_document.publishing_year,
        languages=aleph_document.languages,
        frequencies=[Frequency(**f) for f in aleph_document.frequencies],
        issues=[
            from_aleph_issue(
                aleph_issue,
                get_digitization_state(aleph_issue.barcode, None),
            )
            for aleph_issue in aleph_document.issues
        ],
    )
