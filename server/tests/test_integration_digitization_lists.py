from tests.test_models.test_crud import TestCrudOperations
from helper_funcs import (
    createTestClient,
    createTestUser,
    get_all_actions_except,
    mockUser,
    mock_db,
    get_test_db,
    mock_index,
)
from tests.documents_bank import get_test_documents_with_extraction
from datatypes import ActionType
from services.documents_indexer import DocumentsIndexer, INDEX_NAME
from config import VeraConfig


class TestDigitizationListsIntegration(TestCrudOperations):
    def setUp(self):
        self.indexer = DocumentsIndexer(
            VeraConfig.ElasticsearchUrl,
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
        )
        self.indexer.recreate_index()
        mock_db(get_test_documents_with_extraction())
        self.db = get_test_db()
        mock_index(self.db, self.indexer)
        self.indexer.es.indices.refresh(index=INDEX_NAME)

    def tearDown(self) -> None:
        self.indexer.close()
        return self.db.close()

    def test_create_extraction_permitted(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1, 2]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1, 2])
        self.assertEqual(extraction["extracted_pages"], 751)
        self.assertEqual(extraction["extractor"], "test_user")

    def test_create_extraction_permitted_fail_on_empty_list(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [102]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Empty extraction can not be created", response.json()["detail"]
        )

    def test_create_extraction_permitted_fail_on_document_without_cnb(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [21]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Documents without CNB cannot be extracted",
            response.json()["detail"],
        )

    def test_create_extraction_permitted_fail_on_already_extracted(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1001]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(409, response.status_code)
        self.assertEqual(
            "Some documents have already been extracted",
            response.json()["detail"],
        )

    def test_create_extraction_permitted_fail_on_document_without_page_count(
        self,
    ):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {
                    "must_not": {"exists": {"field": "page_count"}},
                }
            },
            "size": 50,
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Documents without pages count cannot be extracted",
            response.json()["detail"],
        )

    def test_create_extraction_prohibited(self):
        # Arrange
        mockUser(createTestUser(get_all_actions_except([ActionType.Extract])))
        query = {"id_list": [911, 910]}

        # Act
        client = createTestClient()
        response = client.post(
            "/extractions/digitization?intention_id=1",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(403, response.status_code)

    def test_get_extractions_permitted(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))

        # Act
        client = createTestClient()
        response = client.get(
            "/extractions/digitization",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extractions = response.json()["items"]
        self.assertEqual(len(extractions), 1)
        self.assertEqual(extractions[0]["document_ids"], [1001])
        self.assertEqual(extractions[0]["extracted_pages"], 1000)

    def test_get_extraction_permitted(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))

        # Act
        client = createTestClient()
        response = client.get(
            "/extractions/digitization/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1001])
        self.assertEqual(extraction["extracted_pages"], 1000)

    def test_add_documents_to_extraction_permitted(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1, 2]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.put(
            "/extractions/digitization/1/add_documents",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1001, 1, 2])
        self.assertEqual(extraction["extracted_pages"], 1751)

    def test_remove_document_to_extraction(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query_add = {
            "query": {
                "bool": {"must": {"terms": {"id": [1, 2]}}},
            },
            "size": 5,
        }
        query_remove = {
            "query": {
                "bool": {"must": {"terms": {"id": [1001]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response_add = client.put(
            "/extractions/digitization/1/add_documents",
            json=query_add,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_remove = client.put(
            "/extractions/digitization/1/remove_documents",
            json=query_remove,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response_add.status_code)
        self.assertEqual(200, response_remove.status_code)
        extraction = response_remove.json()
        self.assertEqual(extraction["document_ids"], [1, 2])
        self.assertEqual(extraction["extracted_pages"], 751)

    def test_remove_document_to_extraction_run_on_empty_list(self):
        # Arrange
        mockUser(createTestUser([ActionType.Extract]))
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1002]}}},
            },
            "size": 5,
        }

        # Act
        client = createTestClient()
        response = client.put(
            "/extractions/digitization/1/remove_documents",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)

    def test_delete_extraction(self):
        # Arrange
        mockUser(
            createTestUser([ActionType.Extract, ActionType.ReadDatatableAll])
        )

        # Act
        client = createTestClient()
        response = client.delete(
            "/extractions/digitization/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_document = client.get(
            "/documents/1001",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertIsNone(response_document.json()["extraction_id"])
