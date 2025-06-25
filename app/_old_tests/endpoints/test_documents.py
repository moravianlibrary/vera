from .base import TestEndpointsBase
from services.external.digitization_registry import DigitizationState
from models import Category, CatalogRecord, Document
from datatypes import AddDocumentResponseStatus
from exceptions import ObjectNotFoundException

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestDocumentsEndpoints(TestEndpointsBase):
    def setUp(self):
        super().setUp()

        self.session.add_all(
            [
                Category(name="Test Category"),
                Category(name="Test Category 2"),
                CatalogRecord(sysno="TEST-SYSNO", marc=TEST_MARC_BYTES),
            ]
        )
        self.session.flush()
        self.session.add(
            Document(
                sysno="TEST-SYSNO",
                volume="1, test",
                added_by="test_user",
                digitization_state=DigitizationState.NotDigitized,
                category_id=1,
            )
        )
        self.session.flush()

    def test_add_document(self):
        pass
        # Arrange
        # self.mockIndexer()
        # identifier_json = {
        #     "identifier_type": "Sysno",
        #     "value": "MZK03-001066272",
        #     "category_id": 1,
        # }

        # Act
        # response = self.client.post(
        #     "/documents/from_catalog",
        #     json=identifier_json,
        #     headers=self.json_headers,
        # )

        # Assert
        # self.assertEqual(response.status_code, 200)
        # self.assertEqual(
        #     response.json()["status"],
        #     AddDocumentResponseStatus.Success.value,
        # )

        # document = response.json()["document"]

        # self.assertEqual("2610417932", document["issues"][0]["barcode"])
        # self.assertEqual(
        #     DigitizationState.NotDigitized.value,
        #     document["issues"][0]["digitization_state"],
        # )

    def test_add_document_by_sysno_with_some_issues_already_existing(self):
        pass
        # Arrange
        # self.mockIndexer()
        # identifier_json = {
        #     "identifier_type": "Sysno",
        #     "value": "MZK01-001731132",
        #     "category_id": 1,
        # }

        # Act
        # response = self.client.post(
        #     "/documents/from_catalog",
        #     json=identifier_json,
        #     headers={
        #         "Authorization": "Bearer test_token",
        #         "Content-Type": "application/json",
        #     },
        # )

        # Assert
        # self.assertEqual(response.status_code, 200)
        # self.assertEqual(
        #     response.json()["status"],
        #     AddDocumentResponseStatus.MultipleIssues.value,
        # )

        # document = response.json()["document"]
        # for issue in document["issues"]:
        #     self.assertEqual(
        #         issue["barcode"] == "2619868037", issue["already_added"]
        #     )

    def test_update_document_page_count_manual_permitted(self):
        # Act
        response_create = self.client.put(
            "/documents/1?page_count_manual=10",
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

        self.assertEqual(10, document["page_count_manual"])
        self.assertEqual(3, document["extraction_priority"])
        self.assertEqual(1, document["category_id"])

    def test_update_document_extraction_priority_permitted(self):
        # Act
        response_create = self.client.put(
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

        self.assertIsNone(document["page_count_manual"])
        self.assertEqual(5, document["extraction_priority"])
        self.assertEqual(1, document["category_id"])

    def test_update_document_category_permitted(self):
        # Act
        response_create = self.client.put(
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

        self.assertIsNone(document["page_count_manual"])
        self.assertEqual(3, document["extraction_priority"])
        self.assertEqual(2, document["category_id"])

    def test_delete_document(self):
        # Act
        response = self.client.delete(
            "/documents/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        with self.assertRaises(ObjectNotFoundException):
            Document.get(self.session, 1)
