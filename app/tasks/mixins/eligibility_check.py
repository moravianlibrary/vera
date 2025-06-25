from typing import List, NamedTuple, Protocol

from marcdantic import MarcIssue, MarcRecord
from vera_plugins.specs.digitization_registry_adapter import DigitizationRecord

from adapters.digitization_registry import DigitizationRegistryAdapter
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from repositories.catalog_record import CatalogRecordRepository
from repositories.document import DocumentRepository
from repositories.models.catalog_record import CatalogRecordModel
from repositories.models.document import DocumentModel
from services.catalog_search import CatalogSearchService


class EligibilityCheckContext(Protocol):
    _catalog_record_repository: CatalogRecordRepository
    _catalog_search_service: CatalogSearchService
    _digitization_registry: DigitizationRegistryAdapter
    _document_repository: DocumentRepository


class EligibilityCheckResult(NamedTuple):
    eligibility: EligibilityStatus = EligibilityStatus.Eligible
    candidate_records: List[CatalogRecordModel] = []
    marc_issue: MarcIssue | None = None
    document_model: DocumentModel | None = None
    digitization_record: DigitizationRecord | None = None
    error: Exception | None = None

    def with_eligibility(
        self, eligibility: EligibilityStatus
    ) -> "EligibilityCheckResult":
        return EligibilityCheckResult(
            eligibility=eligibility,
            candidate_records=self.candidate_records,
            marc_issue=self.marc_issue,
            digitization_record=self.digitization_record,
            error=self.error,
        )

    def with_failure(
        self, error: Exception, eligibility: EligibilityStatus
    ) -> "EligibilityCheckResult":
        return EligibilityCheckResult(
            eligibility=eligibility,
            candidate_records=self.candidate_records,
            marc_issue=self.marc_issue,
            digitization_record=self.digitization_record,
            error=error,
        )


class EligibilityCheckMixin:
    def _check_eligibility(
        self: EligibilityCheckContext,
        identifier_type: IdentifierType,
        identifier_value: str,
        allow_new_iteration: bool,
        ignore_digitization_check: bool,
    ) -> EligibilityCheckResult:
        # 1. Get candidate catalog records
        catalog_records = self._catalog_record_repository.find_by_identifier(
            identifier_type, identifier_value
        )

        if not catalog_records:
            try:
                search_results = self._catalog_search_service.find_marc_record(
                    identifier_type, identifier_value
                )
            except Exception as error:
                return EligibilityCheckResult(
                    EligibilityStatus.CatalogFailure, error=error
                )

            catalog_records: List[CatalogRecordModel] = []
            for sr in search_results:
                catalog_record = (
                    self._catalog_record_repository.find_by_system_number(
                        sr.base, sr.system_number
                    )
                )
                catalog_records.append(
                    catalog_record
                    if catalog_record
                    else (
                        self._catalog_record_repository.create(
                            sr.base, sr.system_number, sr.record.marc
                        )
                    )
                )

        if not catalog_records:
            return EligibilityCheckResult(EligibilityStatus.RecordNotFound)

        # All of the results will contain candidate catalog records,
        # so we can prepare it here to avoid code duplication
        result = EligibilityCheckResult(candidate_records=catalog_records)

        if len(catalog_records) > 1:
            return result.with_eligibility(
                EligibilityStatus.MultipleRecordsFound
            )

        # 2. Get MARC record from only found catalog record
        if catalog_records:
            marc_record = MarcRecord.from_mrc(catalog_records[0].marc)
        else:
            # Here we don't have to parse MARC record again,
            # because we already have it from search results
            marc_record = search_results[0].record

        # 3. Select issues
        if identifier_type == IdentifierType.Barcode:
            marc_issues = [
                i for i in marc_record.issues if i.barcode == identifier_value
            ]
            if not marc_issues:
                return result.with_eligibility(EligibilityStatus.IssueNotFound)
        else:
            marc_issues = marc_record.issues

        if len(marc_issues) > 1:
            return result.with_eligibility(EligibilityStatus.AmbiguousIssues)

        # 4. Select specific one issue
        marc_issue = marc_issues[0] if marc_issues else None
        result.marc_issue = marc_issue

        # 5. Check if digitization is forbidden
        # TODO: Check DigitizationForbidden

        # 6. Refresh or find digitization record
        #    - Refresh if document_model exists for the issue
        #    - Find for the issue or record if not exists
        document_model = (
            self._document_repository.find_by_barcode(marc_issue.barcode)
            if marc_issue
            else None
        )
        result.document_model = document_model

        try:
            digitization_record = (
                self._digitization_registry.fetch(
                    document_model.digitization_record.registry_issue_id
                )
                if document_model is not None
                else (
                    self._digitization_registry.find_for_marc_issue(
                        marc_record, marc_issue
                    )
                    if marc_issue
                    else self._digitization_registry.find_for_marc_record(
                        marc_record
                    )
                )
            )
        except Exception as error:
            return result.with_failure(
                error, EligibilityStatus.DigitizationRegistryFailure
            )

        result.digitization_record = digitization_record

        # 7. If document model exists, check its iterations
        #    if they are some and if they are active
        if document_model is not None:
            self._document_repository.update_digitization_record(
                document_model, digitization_record
            )

            if document_model.has_active_iteration:
                return result.with_eligibility(
                    EligibilityStatus.ActiveDuplicate
                )
            if document_model.iterations and not allow_new_iteration:
                return result.with_eligibility(
                    EligibilityStatus.FullyProcessedDuplicate
                )

        # 8. Enforce digitization check
        if digitization_record is not None and not ignore_digitization_check:
            return result.with_eligibility(EligibilityStatus.InDigitization)

        return result.with_eligibility(EligibilityStatus.Eligible)
