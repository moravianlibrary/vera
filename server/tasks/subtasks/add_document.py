from typing import Optional, Tuple
from datetime import datetime
from config import VeraConfig
from sqlalchemy.orm import Session
from services.external.digitization_registry import DigitizationState
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from schemas import (
    CatalogDocumentResponse,
    CatalogIssueResponse,
    IdentifierWithAttributes,
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
from .create_catalog_record import create_catalog_record
from .update_catalog_record import update_catalog_record
from mzk_aleph import (
    AlephMzkRecord,
    AlephMzkIssue,
    AlephResponseStatus,
)
from services.predictor import Predictor
from models import CatalogRecord, Document
from dispatchers import get_mzk_client


class AddDocumentsProcessor:
    def __init__(
        self,
        session: Session,
        es_session: EsSession,
        registry_client: DigitizationRegistryClient,
        predictor: Optional[Predictor],
    ):
        self.session = session
        self.es_session = es_session
        self.registry_client = registry_client
        self.predictor = predictor

    def __call__(
        self, attributes: IdentifierWithAttributes, added_by: str
    ) -> Tuple[Optional[CatalogDocumentResponse], AddDocumentResponseStatus]:
        catalog_record, status = self.get_catalog_record(
            attributes.identifier_type, attributes.value
        )

        if catalog_record is None:
            return None, status

        main_aleph_record = AlephMzkRecord(
            catalog_record.main_record, sysno=catalog_record.sysno
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
            if catalog_issue.can_digitize and catalog_issue.document_id is None
        ]
        digitized_issues = [
            active_issue
            for active_issue in active_issues
            if active_issue.digitization_state
            != DigitizationState.NotDigitized
        ]

        if attributes.identifier_type == IdentifierType.Barcode:
            find_catalog_issues = [
                catalog_issue
                for catalog_issue in catalog_issues
                if catalog_issue.barcode == attributes.value
            ]
            if len(find_catalog_issues) != 1:
                return catalog_document, AddDocumentResponseStatus.UnknownError
            add_issue = find_catalog_issues[0]
        elif len(active_issues) - len(digitized_issues) > 1:
            return (
                catalog_document,
                AddDocumentResponseStatus.MultipleIssues,
            )
        elif len(catalog_issues) == len(digitized_issues):
            if any(
                issue.digitization_state == DigitizationState.Unknown
                for issue in active_issues
            ):
                return (
                    catalog_document,
                    AddDocumentResponseStatus.InvalidDigitizationState,
                )
            return (
                catalog_document,
                AddDocumentResponseStatus.AlreadyDigitized,
            )
        elif len(active_issues) - len(digitized_issues) == 0:
            return (
                catalog_document,
                AddDocumentResponseStatus.AllIssuesProcessed,
            )
        else:
            add_issue = active_issues[0]

        if add_issue.document_id is not None:
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
            document = self.create_document(
                main_aleph_record, add_issue, attributes, added_by
            )
            if document is None:
                return catalog_document, AddDocumentResponseStatus.UnknownError
        except exceptions.UniqueDocumentViolationException:
            return catalog_document, AddDocumentResponseStatus.UniqueViolation

        # TODO: handle exceptions
        IndexDocument.model_validate(document).save(self.es_session)

        add_issue.newly_added = True
        add_issue.document_id = document.id
        add_issue.page_count = document.pages_count

        return catalog_document, (
            AddDocumentResponseStatus.Success
            if add_issue.page_count is not None
            else AddDocumentResponseStatus.SuccessWithMissingPageCount
        )

    def get_catalog_issues(
        self, session: Session, main_aleph_record: AlephMzkRecord
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
                Document.find_id_by_identifiers(
                    session,
                    main_aleph_record.sysno,
                    aleph_issue.barcode,
                    aleph_issue.volume,
                    aleph_issue.volume_year,
                    aleph_issue.bundle,
                ),
            )
            for aleph_issue in AlephMzkIssue.from_record(
                main_aleph_record.record
            )
        ]

        return (
            catalog_issues
            if catalog_issues
            else [
                CatalogIssueResponse.from_digitization_registry(
                    DigitizationRegistryClient().get_document_record(
                        cnb=main_aleph_record.cnb, isxn=main_aleph_record.isxn
                    ),
                    Document.find_id_by_identifiers(
                        session, main_aleph_record.sysno
                    ),
                )
            ]
        )

    def get_catalog_record(
        self,
        identifier_type: IdentifierType,
        value: str,
    ) -> Tuple[Optional[CatalogRecord], AddDocumentResponseStatus]:
        mzk_client = get_mzk_client()

        if identifier_type == IdentifierType.Sysno:
            parsed_sysno = mzk_client.parse_sysno(value)
            if parsed_sysno is not None:
                value = parsed_sysno

        catalog_record = CatalogRecord.find_by_identifier(
            self.session, identifier_type, value
        )

        if catalog_record is not None:
            if (
                (datetime.now() - catalog_record.updated_at).seconds
            ) <= VeraConfig.CatalogRecordsValidFor:
                return catalog_record, AddDocumentResponseStatus.Success
            try:
                return (
                    update_catalog_record(
                        self.session, self.es_session, catalog_record
                    ),
                    AddDocumentResponseStatus.Success,
                )
            except Exception:
                return (
                    None,
                    AddDocumentResponseStatus.UnknownError,
                )

        mzk_record, aleph_response_status = get_mzk_client().search_for_record(
            IdentifierToAlephFieldConverted[identifier_type],
            value,
        )

        if aleph_response_status != AlephResponseStatus.Success:
            return (
                None,
                AlephToResponseStatusConverter[aleph_response_status],
            )

        catalog_record = create_catalog_record(
            self.session, self.es_session, mzk_record
        )
        return catalog_record, AlephToResponseStatusConverter.get(
            aleph_response_status
        )

    def create_document(
        self,
        main_aleph_record: AlephMzkRecord,
        catalog_issue: CatalogIssueResponse,
        attributes: IdentifierWithAttributes,
        added_by: str,
    ) -> Document:
        document = Document(
            sysno=main_aleph_record.sysno,
            barcode=catalog_issue.barcode,
            volume=catalog_issue.volume,
            volume_year=catalog_issue.volume,
            bundle=catalog_issue.bundle,
            document_signature=catalog_issue.signature,
            added_by=added_by,
            category_id=attributes.category_id,
            digitization_registry_id=catalog_issue.digitization_registry_id,
            digitization_state=catalog_issue.digitization_state,
            pages_count_catalog=main_aleph_record.parse_page_count(
                catalog_issue.volume
            ),
            pages_count_manual=attributes.page_count_manual,
            extraction_priority=attributes.extraction_priority,
        )
        if not self.predictor:
            return document.save(self.session)

        # TODO: rework
        find_aleph_issues = [
            aleph_issue
            for aleph_issue in AlephMzkIssue.from_record(
                main_aleph_record.record
            )
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
