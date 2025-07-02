from typing import List, Optional, Tuple
from uuid import uuid4

from datatypes import AddDocumentResponseStatus, IdentifierType
from models import CatalogRecord
from mzk_aleph import AlephMzkIssue, AlephMzkRecord, IssuanceType, MaterialType
from pydantic import Field

from config import VeraConfig
from services.external.digitization_registry import (
    DigitizationRegistryRecord,
    DigitizationState,
)

from .base_es_model import BaseEsModel, Date, EsSession, bool, int, str


class CatalogIssueResponse(BaseEsModel):
    issuance_type: Optional[IssuanceType] = None
    barcode: Optional[str] = None
    volume: Optional[str] = None
    volume_year: Optional[str] = None
    bundle: Optional[str] = None
    signature: Optional[str] = None

    document_id: Optional[int] = None
    page_count: Optional[int] = None

    digitization_registry_id: Optional[int] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    can_digitize: bool = True
    newly_added: bool = False
    processing: bool = False

    @classmethod
    def from_aleph_issue(
        cls,
        aleph_record: AlephMzkRecord,
        aleph_issue: AlephMzkIssue,
        digitization_registry_record: DigitizationRegistryRecord,
        document_id: Optional[int] = None,
    ) -> "CatalogIssueResponse":
        return cls(
            issuance_type=aleph_issue.issuance_type,
            barcode=aleph_issue.barcode,
            volume=aleph_issue.volume,
            volume_year=aleph_issue.volume_year,
            bundle=aleph_issue.bundle,
            signature=aleph_issue.signature or aleph_record.signature,
            digitization_registry_id=(
                digitization_registry_record.id
                if digitization_registry_record
                else None
            ),
            digitization_state=(
                digitization_registry_record.digitization_state
                if digitization_registry_record
                else DigitizationState.NotDigitized
            ),
            can_digitize=aleph_issue.can_digitize,
            document_id=document_id,
        )

    @classmethod
    def from_digitization_registry(
        cls,
        digitization_registry_record: DigitizationRegistryRecord,
        document_id: Optional[int] = None,
    ) -> "CatalogIssueResponse":
        return cls(
            digitization_registry_id=(
                digitization_registry_record.id
                if digitization_registry_record
                else None
            ),
            digitization_state=(
                digitization_registry_record.digitization_state
                if digitization_registry_record
                else DigitizationState.NotDigitized
            ),
            document_id=document_id,
        )


class CatalogDocumentResponse(BaseEsModel):
    sysno: str
    title: str
    material_type: MaterialType
    issues: List[CatalogIssueResponse]

    skc_sysno: Optional[str] = None
    has_valid_main_record: bool = False
    cnb_sysno: Optional[str] = None
    has_valid_cnb: bool = False

    @classmethod
    def from_records(
        cls,
        aleph_record: AlephMzkRecord,
        catalog_issues: List[CatalogIssueResponse],
        catalog_record: CatalogRecord,
    ) -> "CatalogDocumentResponse":
        return cls(
            sysno=aleph_record.sysno,
            title=aleph_record.title,
            material_type=aleph_record.material_type,
            issues=catalog_issues,
            skc_sysno=catalog_record.skc_sysno,
            has_valid_main_record=catalog_record.has_valid_main_record,
            cnb_sysno=catalog_record.cnb_sysno,
            has_valid_cnb=catalog_record.has_valid_cnb,
        )

    def replace_issue(self, issue: CatalogIssueResponse):
        if self.issues:
            self.issues = [
                (
                    issue
                    if existing_issue.barcode == issue.barcode
                    else existing_issue
                )
                for existing_issue in self.issues
            ]
        else:
            raise ValueError("Issues list is missing.")


class Identifier(BaseEsModel):
    identifier_type: IdentifierType
    value: str


class IdentifierWithAttributes(Identifier):
    class Config:
        from_attributes = True

    category_id: int
    extraction_priority: Optional[int] = None
    page_count_manual: Optional[int] = None

    @property
    def identifier_pair(self) -> Tuple[IdentifierType, str]:
        return self.identifier_type, self.value


class AddDocumentResponse(BaseEsModel):
    __index_name__ = "add_documents_responses"
    __index_version__ = "v2024.10-1"

    class Config:
        from_attributes = True

    id: str = Field(default_factory=lambda: str(uuid4()))
    attributes: IdentifierWithAttributes
    indexed_at: datetime = VeraConfig.Timestamp.isoformat()
    status: AddDocumentResponseStatus = AddDocumentResponseStatus.Unprocessed
    document: Optional[CatalogDocumentResponse] = None
    added_by: str
    document_id: Optional[int] = None

    def set_issue_processing(self, issue_barcode: str):
        if self.document and self.document.issues:
            issue = next(
                (
                    issue
                    for issue in self.document.issues
                    if issue.barcode == issue_barcode
                ),
                None,
            )

            if issue:
                issue.processing = True
            else:
                raise ValueError(
                    f"Issue with barcode {issue_barcode} not found."
                )
        else:
            raise ValueError("Document or issues list is missing.")

    def replace_issue(self, issue: CatalogIssueResponse):
        if self.document and self.document.issues:
            self.document.replace_issue(issue)
        else:
            raise ValueError("Document is missing.")

    @classmethod
    def get_responses_by_query(
        cls, es_session: EsSession, query
    ) -> List["AddDocumentResponse"]:
        return [
            cls.model_validate(hit["_source"])
            for hit in cls.search(es_session, query)["hits"]["hits"]
        ]

    @classmethod
    def get_unprocessed_responses(
        cls,
        es_session: EsSession,
    ) -> List["AddDocumentResponse"]:
        return cls.get_responses_by_query(
            es_session,
            {
                "size": 50,
                "from": 0,
                "query": {
                    "bool": {"must": {"term": {"status": "Unprocessed"}}}
                },
            },
        )

    @classmethod
    def get_responses_with_sysno(
        cls, es_session: EsSession, sysno: str
    ) -> List["AddDocumentResponse"]:
        return cls.get_responses_by_query(
            es_session,
            {
                "query": {
                    "nested": {
                        "path": "document",
                        "query": {
                            "bool": {
                                "must": [{"term": {"document.sysno": sysno}}]
                            }
                        },
                    }
                }
            },
        )
