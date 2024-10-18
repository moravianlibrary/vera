from typing import Optional, Tuple
from datetime import datetime, timedelta
from config import VeraConfig
from sqlalchemy.orm import Session
from services.external.digitization_registry import DigitizationState
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from schemas import (
    CatalogDocumentResponse,
    CatalogIssueResponse,
    Identifier,
    EsSession,
    IndexDocument,
)
from datatypes import (
    IdentifierType,
    AddDocumentResponseStatus,
    AlephToResponseStatusConverter,
    DigitizationStateToResponseStatusConverter,
    IdentifierToAlephFieldConverted,
)
from services import exceptions
from logic.update_catalog_record import update_catalog_record
from services.external.aleph import (
    AlephClient,
    AlephRecord,
    AlephIssue,
    AlephResponseStatus,
)
from services.predictor import Predictor
from models import CatalogRecord, Document


class AddDocumentPreprocessor:
    def __init__(
        self,
        session: Session,
        es_session: EsSession,
        identifier: Identifier,
        added_by: str,
        category_id: int,
        predict_pages_count: bool = True,
        extraction_priority: Optional[int] = None,
        pages_count_manual: Optional[int] = None,
    ):
        self.session = session
        self.es_session = es_session
        self.identifier = identifier
        self.added_by = added_by
        self.category_id = category_id
        self.registry_client = DigitizationRegistryClient()
        self.predict_pages_count = predict_pages_count
        self.predictor = (
            Predictor.get_instance() if predict_pages_count else None
        )
        self.pages_count_manual = pages_count_manual
        self.extraction_priority = extraction_priority

    def __call__(
        self,
    ) -> Tuple[Optional[CatalogDocumentResponse], AddDocumentResponseStatus]:
        catalog_record, status = self.get_catalog_record()

        if catalog_record is None:
            return None, status

        main_aleph_record = AlephRecord(
            catalog_record.sysno, catalog_record.main_record
        )
        catalog_issues = self.get_catalog_issues(
            self.session, main_aleph_record
        )
        catalog_document = CatalogDocumentResponse.from_records(
            main_aleph_record, catalog_issues, catalog_record
        )
        active_issues = [
            catalog_issue
            for catalog_issue in catalog_issues
            if catalog_issue.can_digitize and not catalog_issue.already_added
        ]
        not_digitized_issues = [
            active_issue
            for active_issue in active_issues
            if active_issue.digitization_state
            == DigitizationState.NotDigitized
        ]

        if self.identifier.identifier_type == IdentifierType.Barcode:
            find_catalog_issues = [
                catalog_issue
                for catalog_issue in catalog_issues
                if catalog_issue.barcode == self.identifier.value
            ]
            if len(find_catalog_issues) != 1:
                return catalog_document, AddDocumentResponseStatus.UnknownError
            add_issue = find_catalog_issues[0]
        elif len(active_issues) > 1:
            return (
                catalog_document,
                AddDocumentResponseStatus.MultipleIssues,
            )
        elif len(active_issues) == 0:
            return (
                catalog_document,
                AddDocumentResponseStatus.AllIssuesProcessed,
            )
        elif len(not_digitized_issues) == 0:
            return (
                catalog_document,
                AddDocumentResponseStatus.AllIssuesProcessed,
            )
        else:
            add_issue = active_issues[0]

        if add_issue.already_added:
            return catalog_document, AddDocumentResponseStatus.UniqueViolation
        if add_issue.digitization_state == DigitizationState.Unknown:
            return (
                catalog_document,
                AddDocumentResponseStatus.InvalidDigitizationState,
            )
        if add_issue.digitization_state != DigitizationState.NotDigitized:
            return (
                catalog_document,
                DigitizationStateToResponseStatusConverter[
                    add_issue.digitization_state
                ],
            )

        try:
            document = self.create_document(main_aleph_record, add_issue)
            if document is None:
                return catalog_document, AddDocumentResponseStatus.UnknownError
        except exceptions.UniqueDocumentViolationException:
            return catalog_document, AddDocumentResponseStatus.UniqueViolation

        # TODO: handle exceptions
        IndexDocument.model_validate(document).save(self.es_session)

        add_issue.newly_added = True
        add_issue.document_id = document.id
        add_issue.page_count = document.pages_count

        return catalog_document, AddDocumentResponseStatus.Success

    def get_catalog_issues(
        self, session: Session, main_aleph_record: AlephRecord
    ):
        digitization_issues = self.registry_client.get_issue_records(
            main_aleph_record.cnb, main_aleph_record.isxn
        )

        catalog_issues = [
            CatalogIssueResponse.from_aleph_issue(
                main_aleph_record,
                aleph_issue,
                self.registry_client.select_volume_record(
                    digitization_issues,
                    aleph_issue.barcode,
                    aleph_issue.volume_year,
                    aleph_issue.volume,
                    aleph_issue.bundle,
                )
                or self.registry_client.get_record_by_barcode(
                    aleph_issue.barcode,
                ),
                Document.exists(
                    session,
                    main_aleph_record.sysno,
                    aleph_issue.barcode,
                    aleph_issue.volume,
                    aleph_issue.volume_year,
                    aleph_issue.bundle,
                ),
            )
            for aleph_issue in AlephIssue.from_record(main_aleph_record.record)
        ]

        return (
            catalog_issues
            if catalog_issues
            else [
                CatalogIssueResponse.from_digitization_registry(
                    DigitizationRegistryClient().get_document_record(
                        cnb=main_aleph_record.cnb, isxn=main_aleph_record.isxn
                    ),
                    Document.exists(session, main_aleph_record.sysno),
                )
            ]
        )

    def get_catalog_record(
        self,
    ) -> Tuple[Optional[CatalogRecord], AddDocumentResponseStatus]:
        catalog_record = CatalogRecord.find_by_identifier(
            self.session,
            self.identifier.identifier_type,
            self.identifier.value,
        )

        if catalog_record is not None and (
            datetime.now() - catalog_record.updated_at
        ) <= timedelta(seconds=VeraConfig.CatalogRecordsValidFor):
            return catalog_record, AddDocumentResponseStatus.Success

        sysno, aleph_response_status = AlephClient().find_sysno(
            IdentifierToAlephFieldConverted[self.identifier.identifier_type],
            self.identifier.value,
        )

        if aleph_response_status != AlephResponseStatus.Success:
            return (
                None,
                AlephToResponseStatusConverter[aleph_response_status],
            )

        catalog_record, aleph_response_status = update_catalog_record(
            self.session, self.es_session, sysno
        )
        return catalog_record, AlephToResponseStatusConverter.get(
            aleph_response_status
        )

    def create_document(
        self,
        main_aleph_record: AlephRecord,
        catalog_issue: CatalogIssueResponse,
    ) -> Document:
        document = Document(
            sysno=main_aleph_record.sysno,
            barcode=catalog_issue.barcode,
            volume=catalog_issue.volume,
            volume_year=catalog_issue.volume,
            bundle=catalog_issue.bundle,
            document_signature=catalog_issue.signature,
            added_by=self.added_by,
            category_id=self.category_id,
            digitization_registry_id=catalog_issue.digitization_registry_id,
            digitization_state=catalog_issue.digitization_state,
            pages_count_catalog=main_aleph_record.parse_page_count(
                catalog_issue.volume
            ),
            pages_count_manual=self.pages_count_manual,
            extraction_priority=self.extraction_priority,
        )
        if not self.predict_pages_count:
            return document.save(self.session)

        # TODO: rework
        find_aleph_issues = [
            aleph_issue
            for aleph_issue in AlephIssue.from_record(main_aleph_record.record)
            if aleph_issue.barcode == catalog_issue.barcode
        ]
        if not find_aleph_issues or len(find_aleph_issues) != 1:
            return document.save(self.session)

        try:
            predicted_page_count = self.predictor.predict_page_count(
                main_aleph_record
            )
        except Exception:
            predicted_page_count = None
        finally:
            document.pages_count_predicted = predicted_page_count
            return document.save(self.session)


def add_document(
    session: Session,
    es_session: EsSession,
    identifier: Identifier,
    added_by: str,
    category_id: int,
    predict_pages_count: bool = True,
    extraction_priority: Optional[int] = None,
    pages_count_manual: Optional[int] = None,
) -> Tuple[Optional[CatalogDocumentResponse], AddDocumentResponseStatus]:
    return AddDocumentPreprocessor(
        session,
        es_session,
        identifier,
        added_by,
        category_id,
        predict_pages_count,
        extraction_priority,
        pages_count_manual,
    )()
