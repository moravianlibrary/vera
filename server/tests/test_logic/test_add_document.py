from tests.test_base_database import TestBaseDatabase
from tests.test_mock_indexer import TestMockIndexer
from unittest.mock import patch, Mock
from tests.patch_resources import (
    patch_aleph_client,
    patch_digitization_registry_client,
    MockAlephClient,
    MockDigitizationRegistryClient,
)
from services.external.digitization_registry import DigitizationRegistryRecord
from logic.add_document import add_document
from datatypes import (
    AlephResponseStatus,
    AddDocumentResponseStatus,
    IdentifierType,
)
from schemas import Identifier, CatalogDocumentResponse, CatalogIssueResponse
from models import CatalogRecord, Category, Document
from typing import Any
from pydantic import BaseModel
from datatypes import MaterialType, IssuanceType, DigitizationState


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
        self.assertEqual(response, expected_response)

    @patch_aleph_client("logic.add_document.AlephClient")
    def test_response_status_not_found_when_sysno_not_found(
        self, mock_aleph_client: MockAlephClient
    ):
        # Arrange
        mock_aleph_client.set_find_sysno_response(
            None,
            AlephResponseStatus.RecordNotFound,
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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

    @patch("logic.add_document.update_catalog_record")
    @patch_aleph_client("logic.add_document.AlephClient")
    def test_response_status_not_found_when_catalog_record_not_found(
        self,
        mock_aleph_client: MockAlephClient,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        mock_aleph_client.set_find_sysno_response(
            "MZK01-123456789",
            AlephResponseStatus.Success,
        )
        mock_update_catalog_record.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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

    @patch("logic.add_document.update_catalog_record")
    @patch_aleph_client("logic.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_one_issue(
        self,
        mock_aleph_client: MockAlephClient,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000164099"

        mock_aleph_client.set_find_sysno_response(
            sysno, AlephResponseStatus.Success
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

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature="2-0653.734",
                        digitization_registry_id=None,
                        digitization_state=DigitizationState.NotDigitized,
                        can_digitize=True,
                        already_added=True,
                    )
                ],
                skc_sysno=None,
                has_valid_main_record=False,
                cnb_sysno=None,
                has_valid_cnb=False,
            ),
        )

    @patch("logic.add_document.update_catalog_record")
    @patch_aleph_client("logic.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_multiple_issues(
        self,
        mock_aleph_client: MockAlephClient,
        mock_update_catalog_record: Mock,
    ):
        # Arrange
        sysno = "MZK01-000121929"

        mock_aleph_client.set_find_sysno_response(
            sysno, AlephResponseStatus.Success
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

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature="2-1028.445",
                        digitization_registry_id=1029635,
                        digitization_state=DigitizationState.Finished,
                        can_digitize=True,
                        already_added=False,
                    ),
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610051177",
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature="2-1028.445",
                        digitization_registry_id=1029635,
                        digitization_state=DigitizationState.Finished,
                        can_digitize=True,
                        already_added=False,
                    ),
                ],
                skc_sysno=None,
                has_valid_main_record=False,
                cnb_sysno=None,
                has_valid_cnb=False,
            ),
        )

    @patch("logic.add_document.AlephIssue")
    @patch("logic.add_document.update_catalog_record")
    @patch_aleph_client("logic.add_document.AlephClient")
    def test_create_new_document_when_catalog_record_with_no_issues(
        self,
        mock_aleph_client: MockAlephClient,
        mock_update_catalog_record: Mock,
        mock_aleph_issue: Mock,
    ):
        # Arrange
        sysno = "MZK03-001175162"

        mock_aleph_client.set_find_sysno_response(
            sysno, AlephResponseStatus.Success
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

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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
                issues=[
                    CatalogIssueResponse(
                        issuance_type=None,
                        barcode=None,
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature=None,
                        digitization_registry_id=None,
                        digitization_state=DigitizationState.NotDigitized,
                        can_digitize=True,
                        already_added=True,
                    )
                ],
                skc_sysno=None,
                has_valid_main_record=False,
                cnb_sysno=None,
                has_valid_cnb=False,
            ),
        )

    @patch_digitization_registry_client(
        "logic.add_document.DigitizationRegistryClient"
    )
    @patch("logic.add_document.update_catalog_record")
    @patch_aleph_client("logic.add_document.AlephClient")
    def test_create_new_document_when_other_issue_is_already_added(
        self,
        mock_aleph_client: MockAlephClient,
        mock_update_catalog_record: Mock,
        mock_digitization_registry_client: MockDigitizationRegistryClient,
    ):
        # Arrange
        sysno = "MZK01-000121929"

        mock_aleph_client.set_find_sysno_response(
            sysno, AlephResponseStatus.Success
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

        mock_digitization_registry_client.set_record_response(None)

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
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
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature="2-1028.445",
                        digitization_registry_id=1029635,
                        digitization_state=DigitizationState.NotDigitized,
                        can_digitize=True,
                        already_added=True,
                    ),
                    CatalogIssueResponse(
                        issuance_type=IssuanceType.Unit,
                        barcode="2610051177",
                        volume=None,
                        volume_year=None,
                        bundle=None,
                        signature="2-1028.445",
                        digitization_registry_id=1029635,
                        digitization_state=DigitizationState.NotDigitized,
                        can_digitize=True,
                        already_added=True,
                    ),
                ],
                skc_sysno=None,
                has_valid_main_record=False,
                cnb_sysno=None,
                has_valid_cnb=False,
            ),
        )
