from typing import List, Optional
from datatypes import AddDocumentResponseStatus, IdentifierType
from services.external.aleph import AlephRecord
from services.external.aleph import AlephIssue
from services.external.aleph import MaterialType, IssuanceType
from services.external.digitization_registry import (
    DigitizationRegistryRecord,
)
from services.external.digitization_registry import DigitizationState
from models import CatalogRecord
from .base_es_model import (
    BaseEsModel,
    Keyword,
    Boolean,
    Integer,
    Date,
)
from pydantic import Field
from uuid import uuid4
from config import VeraConfig


class CatalogIssueResponse(BaseEsModel):
    issuance_type: Optional[IssuanceType] = None
    barcode: Optional[Keyword] = None
    volume: Optional[Keyword] = None
    volume_year: Optional[Keyword] = None
    bundle: Optional[Keyword] = None
    signature: Optional[Keyword] = None

    document_id: Optional[Integer] = None
    page_count: Optional[Integer] = None

    digitization_registry_id: Optional[Integer] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    can_digitize: Boolean = True
    newly_added: Boolean = False
    processing: Boolean = False

    @classmethod
    def from_aleph_issue(
        cls,
        aleph_record: AlephRecord,
        aleph_issue: AlephIssue,
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
    sysno: Keyword
    title: Keyword
    material_type: MaterialType
    issues: List[CatalogIssueResponse]

    skc_sysno: Optional[Keyword] = None
    has_valid_main_record: Boolean = False
    cnb_sysno: Optional[Keyword] = None
    has_valid_cnb: Boolean = False

    @classmethod
    def from_records(
        cls,
        aleph_record: AlephRecord,
        catalog_issues: List[CatalogIssueResponse],
        catalog_record: CatalogRecord,
    ) -> "CatalogDocumentResponse":
        return cls(
            sysno=aleph_record.sysno,
            title=aleph_record.title,
            material_type=aleph_record.material_type,
            issues=catalog_issues,
            # issues=(
            #     catalog_issues[0]
            #     if len(catalog_issues) == 1
            #     else catalog_issues
            # ),
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
    value: Keyword


class IdentifierWithAttributes(Identifier):
    class Config:
        from_attributes = True

    category_id: Integer
    extraction_priority: Optional[Integer] = None
    page_count_manual: Optional[Integer] = None


class AddDocumentResponse(BaseEsModel):
    __index_name__ = "add_documents_responses"
    __index_version__ = "v2024.10-1"

    class Config:
        from_attributes = True

    id: Keyword = Field(default_factory=lambda: str(uuid4()))
    attributes: IdentifierWithAttributes
    indexed_at: Date = VeraConfig.Timestamp.isoformat()
    status: AddDocumentResponseStatus = AddDocumentResponseStatus.Unprocessed
    document: Optional[CatalogDocumentResponse] = None
    added_by: Keyword
    parent_id: Optional[Keyword] = None

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
