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
    r"(?:IX|ix|IV|iv|V?I{0,3}|v?i{0,3})\]?\s*-?\s*)?"
    r"(\d+)\s*"
    r"(?:[,-]\s*\[?(?:\d+|(?:XC|xc|XL|xl|L?X{0,3}|l?x{0,3})"
    r"(?:IX|ix|IV|iv|V?I{0,3}|v?i{0,3}))\]?)?\s*"
    r"(s\.|stran).*"
)


def parse_page_count(extent: Optional[str]) -> Optional[int]:
    if extent is None:
        return None
    match = re.search(PAGE_COUNT_FORMAT, extent)
    return int(match.group(1)) if match else None


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
