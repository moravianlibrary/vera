from tests.test_base_database import TestBaseDatabase
from tests.test_mock_indexer import TestMockIndexer
from unittest.mock import patch, Mock
from tasks.subtasks.add_document import AddDocumentsProcessor
from datatypes import (
    AlephResponseStatus,
    AddDocumentResponseStatus,
    IdentifierType,
)
from schemas import (
    IdentifierWithAttributes,
    CatalogDocumentResponse,
    CatalogIssueResponse,
    DigitizationRegistryRecord,
)
from models import CatalogRecord, CatalogRecordBarcode, Category, Document
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from services.predictor import Predictor
from typing import Any
from pydantic import BaseModel
from datatypes import MaterialType, IssuanceType, DigitizationState
from typing import Optional


class TestAddDocumentLogic(TestBaseDatabase, TestMockIndexer):
    def setUp(self):
        TestBaseDatabase.setUp(self)
        TestMockIndexer.setUp(self)

    def setUpProcessor(self, registry_client: Optional[Mock] = None):
        self.add_documents_processor = AddDocumentsProcessor(
            self.session,
            self.getMockEsSession(),
            registry_client or DigitizationRegistryClient(),
            Predictor.get_instance(),
        )

    def read_marc_bytes(self, sysno, filepath="tests/aleph_records"):
        with open(f"{filepath}/{sysno}.marc", "rb") as f:
            return f.read()

    def assertIsResponse(self, response: Any, expected_response: BaseModel):
        self.assertIsInstance(response, BaseModel)
        self.assertIsInstance(response, expected_response.__class__)
        self.maxDiff = None
        self.assertDictEqual(
            response.model_dump(), expected_response.model_dump()
        )

    def getMockDigitizationRecord(
        self,
        digitization_record: Optional[DigitizationRegistryRecord] = None,
    ):
        instance = Mock()
        instance.get_issue_records.return_value = [digitization_record]
        instance.select_volume_record.return_value = digitization_record
        instance.get_record_by_barcode.return_value = digitization_record
        instance.get_document_record.return_value = digitization_record
        return instance

    @patch("tasks.add_document.AlephClient")
    def test_response_status_not_found_when_sysno_not_found(
        self, mock_aleph_client: Mock
    ):
        # Arrange
        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        mock_digitization_registry_client = Mock()
        self.setUpProcessor(mock_digitization_registry_client)

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch("tasks.add_document.update_catalog_record")
    @patch("tasks.add_document.AlephClient")
    def test_response_status_not_found_when_catalog_record_not_found(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-123456789"
        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            sysno,
            AlephResponseStatus.Success,
        )

        mock_update_catalog_record.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        self.setUpProcessor()

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch("tasks.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_issue(
        self,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        self.session.add_all(
            [
                catalog_record,
                Category(
                    name="test_category",
                ),
            ]
        )
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.Success)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno=sysno,
                title="Moderní lesní školkařství /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2619937640",
                        signature="2-0653.734",
                        newly_added=True,
                        document_id=1,
                        page_count=480,
                    )
                ],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    def test_add_document_when_catalog_record_with_one_already_added(
        self,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        self.session.add_all(
            [
                catalog_record,
                Category(
                    name="test_category",
                ),
            ]
        )
        self.session.flush()
        self.session.add(Document(sysno=sysno, barcode="2619937640"))
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AllIssuesProcessed)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno=sysno,
                title="Moderní lesní školkařství /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2619937640",
                        signature="2-0653.734",
                        document_id=1,
                    )
                ],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    def test_add_document_with_barcode_when_record_with_one_already_added(
        self,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        self.session.add_all(
            [
                catalog_record,
                Category(
                    name="test_category",
                ),
            ]
        )
        self.session.add(
            CatalogRecordBarcode(sysno=sysno, barcode="2619937640")
        )
        self.session.add(Document(sysno=sysno, barcode="2619937640"))
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Barcode,
                value="2619937640",
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.UniqueViolation)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno=sysno,
                title="Moderní lesní školkařství /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2619937640",
                        signature="2-0653.734",
                        document_id=1,
                    )
                ],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_digitized_issue(
        self,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        self.session.add_all(
            [
                catalog_record,
                Category(
                    name="test_category",
                ),
            ]
        )
        self.session.flush()

        self.setUpProcessor(
            self.getMockDigitizationRecord(
                DigitizationRegistryRecord({"id": 1, "stav": "dokončeno"})
            )
        )

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlreadyDigitized)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno=sysno,
                title="Moderní lesní školkařství /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2619937640",
                        signature="2-0653.734",
                        digitization_registry_id=1,
                        digitization_state=DigitizationState.Finished,
                    )
                ],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_unknown_state(
        self,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        self.session.add_all(
            [
                catalog_record,
                Category(
                    name="test_category",
                ),
            ]
        )
        self.session.flush()

        self.setUpProcessor(
            self.getMockDigitizationRecord(
                DigitizationRegistryRecord({"id": 1, "stav": "revize"}),
            )
        )

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(
            status, AddDocumentResponseStatus.InvalidDigitizationState
        )
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno=sysno,
                title="Moderní lesní školkařství /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2619937640",
                        signature="2-0653.734",
                        digitization_registry_id=1,
                        digitization_state=DigitizationState.Unknown,
                    )
                ],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    @patch("tasks.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_multiple_issues(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000121929"

        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            sysno,
            AlephResponseStatus.Success,
        )

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        category = Category(
            name="test_category",
        )

        self.session.add_all([catalog_record, category])
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.MultipleIssues)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno="MZK01-000121929",
                title="Zakázanou zemí : cesta Pařížanky do Lhasy /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610046383",
                        signature="2-1028.445",
                    ),
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610051177",
                        signature="2-1028.445",
                    ),
                ],
            ),
        )

    @patch("tasks.add_document.AlephMzkIssue")
    @patch("tasks.add_document.update_catalog_record")
    @patch("tasks.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_no_issues(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
        mock_aleph_issue: Mock,
    ):
        # Arrange
        sysno = "MZK03-001175162"

        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            sysno,
            AlephResponseStatus.Success,
        )

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        mock_aleph_issue.from_record.return_value = []

        category = Category(
            name="test_category",
        )

        self.session.add_all([catalog_record, category])
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(
            status, AddDocumentResponseStatus.SuccessWithMissingPageCount
        )
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno="MZK03-001175162",
                title="Albert, Abt zu St. Peter in Salzburg",
                material_type=MaterialType.Graphic,
                issues=[CatalogIssueResponse(newly_added=True, document_id=1)],
            ),
        )

    @patch("tasks.add_document.update_catalog_record")
    @patch("tasks.add_document.AlephClient")
    def test_create_new_document_when_other_issue_is_already_added(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000121929"

        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            sysno,
            AlephResponseStatus.Success,
        )

        catalog_record = CatalogRecord(
            sysno=sysno,
            marc=self.read_marc_bytes(sysno),
        )
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        category = Category(
            name="test_category",
        )

        self.session.add_all([catalog_record, category])
        self.session.flush()

        self.session.add(
            Document(
                sysno=sysno,
                barcode="2610046383",
            )
        )
        self.session.flush()

        self.setUpProcessor(self.getMockDigitizationRecord())

        # Act
        response, status = self.add_documents_processor(
            IdentifierWithAttributes(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
                category_id=1,
            ),
            "test_user",
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.Success)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno="MZK01-000121929",
                title="Zakázanou zemí : cesta Pařížanky do Lhasy /",
                material_type=MaterialType.Book,
                issues=[
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610046383",
                        signature="2-1028.445",
                        document_id=1,
                    ),
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610051177",
                        signature="2-1028.445",
                        newly_added=True,
                        document_id=2,
                        page_count=364,
                    ),
                ],
            ),
        )
