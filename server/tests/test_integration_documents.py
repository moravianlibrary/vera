from tests.test_integration import TestIntegration
from helper_funcs import (
    createTestClient,
    createTestUser,
    mockUser,
    mock_db,
)

from datatypes import ActionType
from services.external.digitization_registry import DigitizationState
from services.external.aleph import AlephClient
from models import Category, CatalogRecord, Document
from datatypes import AddDocumentResponseStatus


class TestDocumentsIntegration(TestIntegration):
    def document_update_data(self):
        return [
            Category(
                id=1,
                name="Test Category",
            ),
            Category(
                id=2,
                name="Test Category 2",
            ),
            CatalogRecord(
                sysno="TEST-SYSNO",
            ),
            Document(
                sysno="TEST-SYSNO",
                volume="1, test",
                added_by="test_user",
                digitization_state=DigitizationState.NotDigitized,
                category_id=1,
            ),
        ]

    def test_update_document_page_count_manual_permitted(self):
        # Arrange
        mock_db(self.document_update_data())
        mockUser(createTestUser([ActionType.EditDatatableOwn]))

        # Act
        client = createTestClient()
        response_create = client.put(
            "/documents/1?pages_count_manual=10",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_create.status_code, 200)
        document = response_create.json()

        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])

        self.assertEqual(10, document["pages_count_manual"])
        self.assertEqual(3, document["extraction_priority"])
        self.assertEqual(1, document["category_id"])

    def test_update_document_extraction_priority_permitted(self):
        # Arrange
        mock_db(self.document_update_data())
        mockUser(createTestUser([ActionType.EditDatatableOwn]))

        # Act
        client = createTestClient()
        response_create = client.put(
            "/documents/1?extraction_priority=5",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_create.status_code, 200)
        document = response_create.json()

        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])

        self.assertIsNone(document["pages_count_manual"])
        self.assertEqual(5, document["extraction_priority"])
        self.assertEqual(1, document["category_id"])

    def test_update_document_category_permitted(self):
        # Arrange
        mock_db(self.document_update_data())
        mockUser(createTestUser([ActionType.EditDatatableOwn]))

        # Act
        client = createTestClient()
        response_create = client.put(
            "/documents/1?category_id=2",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_create.status_code, 200)
        document = response_create.json()

        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])

        self.assertIsNone(document["pages_count_manual"])
        self.assertEqual(3, document["extraction_priority"])
        self.assertEqual(2, document["category_id"])

    def test_add_document(self):
        # Arrange
        mock_db([Category(name="Test Category")])
        mockUser(createTestUser([ActionType.InsertDatatable]))
        identifier_json = {
            "identifier_type": "Sysno",
            "value": "mzk03001066272",
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/documents/from_catalog?category_id=1",
            json=identifier_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["status"],
            AddDocumentResponseStatus.Success.value,
        )

        document = response.json()["document"]

        self.assertEqual("2610417932", document["issues"][0]["barcode"])
        self.assertEqual(
            DigitizationState.NotDigitized.value,
            document["issues"][0]["digitization_state"],
        )

    def test_insert_by_sysno_with_some_issues_already_existing(self):
        # Arrange
        mock_db(
            [
                Category(
                    name="Test Category",
                ),
                CatalogRecord(
                    sysno="MZK01-001731132",
                    marc=AlephClient()
                    .get_record("MZK01-001731132")[0]
                    .record.as_marc(),
                ),
                Document(
                    sysno="MZK01-001731132", volume="39", barcode="2619868037"
                ),
            ]
        )
        mockUser(createTestUser([ActionType.InsertDatatable]))
        identifier_json = {
            "identifier_type": "Sysno",
            "value": "MZK01-001731132",
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/documents/from_catalog?category_id=1",
            json=identifier_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["status"],
            AddDocumentResponseStatus.MultipleIssues.value,
        )

        document = response.json()["document"]
        for issue in document["issues"]:
            self.assertEqual(
                issue["barcode"] == "2619868037", issue["already_added"]
            )

    def test_catalog_records_similarities(self):
        # Arrange
        mock_db([Category(name="Test Category")])
        mockUser(createTestUser([ActionType.InsertDatatable]))
        identifier_json = {
            "identifier_type": "Sysno",
            "value": "MZK01-000033633",
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/documents/from_catalog?category_id=1",
            json=identifier_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["status"],
            AddDocumentResponseStatus.MultipleIssues.value,
        )

        document = response.json()["document"]

        print(document)
