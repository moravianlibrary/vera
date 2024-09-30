from tests.test_base_database import TestBaseDatabase
from tests.test_mock_indexer import TestMockIndexer
from unittest.mock import patch, Mock
from logic.add_document import add_document
from datatypes import (
    AlephResponseStatus,
    AddDocumentResponseStatus,
    IdentifierType,
)
from schemas import (
    Identifier,
    CatalogDocumentResponse,
    CatalogIssueResponse,
    DigitizationRegistryRecord,
)
from models import CatalogRecord, CatalogRecordBarcode, Category, Document
from typing import Any
from pydantic import BaseModel
from datatypes import MaterialType, IssuanceType, DigitizationState
from typing import Optional


class TestAddDocumentLogic(TestBaseDatabase, TestMockIndexer):
    def setUp(self):
        TestBaseDatabase.setUp(self)
        TestMockIndexer.setUp(self)

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

    def mockDigitizationRecord(
        self,
        mock_digitization_registry_client: Mock,
        digitization_record: Optional[DigitizationRegistryRecord] = None,
    ):
        instance = mock_digitization_registry_client.return_value
        instance.get_record.return_value = digitization_record

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.AlephClient")
    def test_response_status_not_found_when_sysno_not_found(
        self, mock_aleph_client: Mock, mock_digitization_registry_client: Mock
    ):
        # Arrange
        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno, value="123456789"
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    @patch("logic.add_document.AlephClient")
    def test_response_status_not_found_when_catalog_record_not_found(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
    ):
        # Arrange
        sysno = ("MZK01-123456789",)
        mock_aleph_client_instance = mock_aleph_client.return_value
        mock_aleph_client_instance.find_sysno.return_value = (
            sysno,
            AlephResponseStatus.Success,
        )

        mock_update_catalog_record.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_issue(
        self,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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
                    )
                ],
            ),
        )

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    def test_add_document_when_catalog_record_with_one_already_added(
        self,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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
                        already_added=True,
                    )
                ],
            ),
        )

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    def test_add_document_with_barcode_when_record_with_one_already_added(
        self,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Barcode,
                value="2619937640",
            ),
            "test_user",
            1,
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
                        already_added=True,
                    )
                ],
            ),
        )

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_digitized_issue(
        self,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(
            mock_digitization_registry_client,
            DigitizationRegistryRecord({"id": 1, "stav": "dokončeno"}),
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_unknown_state(
        self,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(
            mock_digitization_registry_client,
            DigitizationRegistryRecord({"id": 1, "stav": "revize"}),
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    @patch("logic.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_multiple_issues(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.AlephIssue")
    @patch("logic.add_document.update_catalog_record")
    @patch("logic.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_no_issues(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
        mock_aleph_issue: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.Success)
        self.assertIsResponse(
            response,
            CatalogDocumentResponse(
                sysno="MZK03-001175162",
                title="Albert, Abt zu St. Peter in Salzburg",
                material_type=MaterialType.Graphic,
                issues=[CatalogIssueResponse(newly_added=True)],
            ),
        )

    @patch("logic.add_document.DigitizationRegistryClient")
    @patch("logic.add_document.update_catalog_record")
    @patch("logic.add_document.AlephClient")
    def test_create_new_document_when_other_issue_is_already_added(
        self,
        mock_aleph_client: Mock,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: Mock,
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

        self.mockDigitizationRecord(mock_digitization_registry_client)

        # Act
        response, status = add_document(
            self.session,
            self.getMockEsSession(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value=sysno,
            ),
            "test_user",
            1,
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
                        already_added=True,
                    ),
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610051177",
                        signature="2-1028.445",
                        newly_added=True,
                    ),
                ],
            ),
        )
