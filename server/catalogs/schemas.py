from pydantic import BaseModel
import re
from typing import Dict, List, Optional

from catalogs.aleph_document import AlephDocument, AlephIssue
from catalogs.enums import (
    CatalogResponseStatus,
    DigitizationState,
    IdentifierType,
    IssuanceType,
    MaterialType,
)

PAGE_COUNT_FORMAT = r"^(\d+) s.*"
MATERIAL_TYPE_MAPPING = {
    "BK": MaterialType.Book,
    "CR": MaterialType.ContinuingResource,
    "SE": MaterialType.ContinuingResource,
    "MP": MaterialType.Map,
    "MU": MaterialType.Music,
}


def parse_page_count(extent: Optional[str]) -> Optional[int]:
    if extent is None:
        return None
    match = re.search(PAGE_COUNT_FORMAT, extent)
    return int(match.group(1)) if match else None


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str


class CatalogIssue(BaseModel):
    type: IssuanceType
    barcode: Optional[str]
    signature: Optional[str]
    year: Optional[str] = None
    volume: Optional[str] = None
    bundle: Optional[str] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized
    already_exists: bool = False

    @classmethod
    def from_aleph_issue(
        cls,
        aleph_issue: AlephIssue,
        digitization_state: DigitizationState,
    ) -> "CatalogIssue":
        return cls(
            type=aleph_issue.type,
            barcode=aleph_issue.barcode,
            signature=aleph_issue.signature,
            year=aleph_issue.year,
            volume=aleph_issue.volume,
            bundle=aleph_issue.bundle,
            digitization_state=digitization_state,
        )


class CatalogDocument(BaseModel):
    sysno: str
    volume: Optional[str] = None
    barcode: Optional[str] = None

    cnb: Optional[str] = None
    isbn_issn: Optional[str] = None
    sigla: Optional[str] = None
    signature: Optional[str] = None

    material_type: Optional[MaterialType] = None
    title: Optional[str] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    year: Optional[str] = None
    bundle: Optional[str] = None

    # part_number: Optional[str] = None
    # part_title: Optional[str] = None
    # edition: Optional[str] = None

    # extent: Optional[str] = None
    pages_count: Optional[int] = None
    # additional_physical_data: Optional[str] = None
    size: Optional[str] = None

    publishers: List[str] = []
    publishing_places: List[str] = []

    publisher: Optional[str] = None
    publishing_place: Optional[str] = None
    publishing_year: Optional[str] = None
    languages: List[str] = []

    frequencies: List[Dict[str, str]] = []
    issues: List[CatalogIssue]

    @classmethod
    def from_aleph_document(
        cls,
        aleph_document: AlephDocument,
    ) -> "CatalogIssue":
        from catalogs.digitization_registry import get_digitization_state

        one_issue = aleph_document.issues and len(aleph_document.issues) == 1
        issue = aleph_document.issues[0] if one_issue else None
        return cls(
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
            publishers=aleph_document.publishers,
            publishing_places=aleph_document.publishing_places,
            publisher=aleph_document.publisher,
            publishing_place=aleph_document.publishing_place,
            publishing_year=aleph_document.publishing_year,
            languages=aleph_document.languages,
            frequencies=aleph_document.frequencies,
            issues=[
                CatalogIssue.from_aleph_issue(
                    aleph_issue,
                    get_digitization_state(aleph_issue.barcode, None),
                )
                for aleph_issue in aleph_document.issues
            ],
        )


class CatalogResponse(BaseModel):
    document: Optional[CatalogDocument] = None
    response_status: CatalogResponseStatus
