from pydantic import BaseModel
from typing import List, Optional

from catalogs.enums import (
    CatalogResponseStatus,
    DigitizationState,
    IdentifierType,
    IssuanceType,
    MaterialType,
)


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
    can_digitize: bool = True


class Frequency(BaseModel):
    frequency: str
    date: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True


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
    locationUri: Optional[str] = None

    publishers: List[str] = []
    publishing_places: List[str] = []

    publisher: Optional[str] = None
    publishing_place: Optional[str] = None
    publishing_year: Optional[str] = None
    languages: List[str] = []

    frequencies: List[Frequency] = []
    issues: List[CatalogIssue]


class CatalogResponse(BaseModel):
    document: Optional[CatalogDocument] = None
    response_status: CatalogResponseStatus
