from pydantic import BaseModel, validator
from typing import List, Optional
from pymarc import Record, MARCReader
from schemas.types.catalog_types import IdentifierType
from services.external.aleph.record import AlephRecord
from services.external.aleph.issue import AlephIssue
from services.external.aleph.types import MaterialType, IssuanceType
from services.external.digitization_registry.record import (
    DigitizationRegistryRecord,
)
from services.external.digitization_registry.types import DigitizationState


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str


class CatalogIssue(BaseModel):
    issuance_type: Optional[IssuanceType] = None
    barcode: Optional[str] = None
    volume: Optional[str] = None
    volume_year: Optional[str] = None
    bundle: Optional[str] = None
    signature: Optional[str] = None

    digitization_registry_id: Optional[int] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    can_digitize: bool = True
    already_added: bool = False

    @classmethod
    def from_aleph_issue(
        cls,
        aleph_record: AlephRecord,
        aleph_issue: AlephIssue,
        digitization_registry_record: DigitizationRegistryRecord,
        already_added: bool,
    ) -> "CatalogIssue":
        return cls(
            issuance_type=aleph_issue.issuance_type,
            barcode=aleph_issue.barcode,
            volume=aleph_issue.volume,
            volume_year=aleph_issue.volume_year,
            bundle=aleph_issue.bundle,
            signature=aleph_issue.signature or aleph_record.signature,
            digitization_registry_id=digitization_registry_record.id,
            digitization_state=digitization_registry_record.state,
            can_digitize=aleph_issue.can_digitize,
            already_added=already_added,
        )

    @classmethod
    def from_aleph_record(
        cls,
        aleph_record: AlephRecord,
        digitization_registry_record: DigitizationRegistryRecord,
        already_added: bool,
    ) -> "CatalogIssue":
        return cls(
            signature=aleph_record.signature,
            digitization_registry_id=digitization_registry_record.id,
            digitization_state=digitization_registry_record.state,
            already_added=already_added,
        )


class CatalogRecord(BaseModel):
    sysno: str
    marc: Record

    skc_sysno: Optional[str]
    skc_marc: Optional[Record]
    skc_confidence: Optional[int]

    cnb_sysno: Optional[str]
    cnb_marc: Optional[Record]
    cnb_confidence: Optional[int]

    last_updated: Optional[str]

    @validator("marc", "skc_marc", "cnb_marc", pre=True)
    def parse_marc(cls, value):
        if value:
            return cls.convert_to_record(value)
        return None

    @staticmethod
    def convert_to_record(data: bytes) -> Optional[Record]:
        with MARCReader(data) as reader:
            for record in reader:
                return record
        return None

    class Config:
        arbitrary_types_allowed = True
        orm_mode = True


class CatalogDocument(BaseModel):
    sysno: str
    title: str
    material_type: MaterialType
    issues: List[CatalogIssue]

    skc_sysno: Optional[str] = None
    skc_confidence: float = 0
    cnb_sysno: Optional[str] = None
    cnb_confidence: float = 0

    @classmethod
    def from_records(
        cls,
        aleph_record: AlephRecord,
        catalog_issues: List[CatalogIssue],
        catalog_record: CatalogRecord,
    ) -> "CatalogDocument":
        return cls(
            sysno=aleph_record.sysno,
            title=aleph_record.title,
            material_type=aleph_record.material_type,
            issues=catalog_issues,
            skc_sysno=catalog_record.skc_sysno,
            skc_confidence=catalog_record.skc_confidence,
            cnb_sysno=catalog_record.cnb_sysno,
            cnb_confidence=catalog_record.cnb_confidence,
        )


class Frequency(BaseModel):
    frequency: str
    date: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True
