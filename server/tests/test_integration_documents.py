from tests.test_integration import TestIntegration
from helper_funcs import (
    createTestClient,
    createTestUser,
    mockUser,
    mock_db,
)

from schemas.types.action_type import ActionType
from models.documents import Document
from services.external.digitization_registry.types import DigitizationState
from schemas.types.documents_types import AddDocumentResponseStatus


class TestDocumentsIntegration(TestIntegration):
    def test_create_delete_document(self):
        # Arrange
        mock_db()
        mockUser(
            createTestUser(
                [ActionType.WriteDatatable, ActionType.EditDatatableOwn]
            )
        )
        document_json = {
            "sysno": "TEST-SYSNO",
            "volume": "1, test",
            "title": "Test Document",
        }

        # Act - create
        client = createTestClient()
        response_create = client.post(
            "/documents/new",
            json=document_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert - create
        self.assertEqual(response_create.status_code, 200)
        self.assertEqual(
            response_create.json()["create_result"],
            AddDocumentResponseStatus.Success.value,
        )

        document = response_create.json()["document"]
        self.assertTrue(1, document["id"])
        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])
        self.assertEqual("Test Document", document["title"])

        # Act - delete
        response_delete = client.delete(
            "/documents/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert - delete
        self.assertEqual(response_delete.status_code, 200)

    def test_create_delete_document_delete_prohibited(self):
        # Arrange
        mock_db()
        mockUser(createTestUser([ActionType.WriteDatatable]))
        document_json = {
            "sysno": "TEST-SYSNO",
            "volume": "1, test",
            "title": "Test Document",
        }

        # Act - create
        client = createTestClient()
        response_create = client.post(
            "/documents/new",
            json=document_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert - create
        self.assertEqual(response_create.status_code, 200)
        self.assertEqual(
            response_create.json()["create_result"],
            AddDocumentResponseStatus.Success.value,
        )

        document = response_create.json()["document"]
        self.assertTrue(1, document["id"])
        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])
        self.assertEqual("Test Document", document["title"])

        # Act - delete
        response_delete = client.delete(
            "/documents/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert - delete
        self.assertEqual(response_delete.status_code, 403)

    def test_update_document_with_write_permission(self):
        # Arrange
        mock_db(
            [
                Document(
                    sysno="TEST-SYSNO",
                    volume="1, test",
                    title="Test Document",
                    creator="test_user",
                )
            ]
        )
        mockUser(
            createTestUser(
                [ActionType.EditDatatableOwn, ActionType.WriteDatatable]
            )
        )
        document_json = {
            "sysno": "TEST-SYSNO",
            "volume": "1, test - updated",
            "title": "Test Document Updated",
        }

        # Act
        client = createTestClient()
        response_create = client.put(
            "/documents/1",
            json=document_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_create.status_code, 200)
        document = response_create.json()
        self.assertTrue(1, document["id"])
        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test - updated", document["volume"])
        self.assertEqual("Test Document Updated", document["title"])

    def test_update_document_without_write_permission(self):
        # Arrange
        mock_db(
            [
                Document(
                    sysno="TEST-SYSNO",
                    volume="1, test",
                    title="Test Document",
                    creator="test_user",
                )
            ]
        )
        mockUser(createTestUser([ActionType.EditDatatableOwn]))
        document_json = {
            "sysno": "TEST-SYSNO",
            "volume": "1, test - updated",
            "title": "Test Document Updated",
            "pages_count_manual": 10,
        }

        # Act
        client = createTestClient()
        response_create = client.put(
            "/documents/1",
            json=document_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_create.status_code, 200)
        document = response_create.json()
        self.assertTrue(1, document["id"])
        self.assertEqual("TEST-SYSNO", document["sysno"])
        self.assertEqual("1, test", document["volume"])
        self.assertEqual("Test Document", document["title"])
        self.assertEqual(10, document["pages_count_manual"])

    def test_create_from_catalog(self):
        # Arrange
        mock_db()
        mockUser(createTestUser([ActionType.InsertDatatable]))
        identifier_json = {
            "identifier_type": "Sysno",
            "value": "mzk03001066272",
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/documents/from_catalog",
            json=identifier_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["create_result"],
            AddDocumentResponseStatus.Success.value,
        )
        document = response.json()["document"]
        self.assertEqual("2610417932", document["barcode"])
        self.assertEqual(
            DigitizationState.NotDigitized.value,
            document["digitization_state"],
        )

    def test_insert_by_sysno_with_some_issues_already_existing(self):
        # Arrange
        mock_db(
            [
                Document(
                    sysno="MZK01-000165329", volume="39", barcode="2619868037"
                )
            ]
        )
        mockUser(createTestUser([ActionType.InsertDatatable]))
        identifier_json = {
            "identifier_type": "Sysno",
            "value": "MZK01-000165329",
        }

        # Act
        client = createTestClient()
        response = client.post(
            "/documents/from_catalog",
            json=identifier_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["create_result"],
            AddDocumentResponseStatus.MultipleIssues.value,
        )

        catalog_document = response.json()["catalog_document"]
        for issue in catalog_document["issues"]:
            self.assertEqual(
                issue["barcode"] == "2619868037", issue["already_exists"]
            )

        self.assertEqual(
            catalog_document["locationUri"],
            "http://www.digitalniknihovna.cz/mzk/"
            "uuid/uuid:3e68f1f0-9d7f-11e4-a2db-005056825209",
        )

    # def test_insert_with_frequencies(self):
    #     sysno1 = "MZK01-000165329"
    #     sysno2 = "MZK01-000230291"

    #     response = self.client.post(
    #         "/catalogs",
    #         json={"identifier_type": "Sysno", "value": sysno1},
    #     )
    #     self.assertEqual(response.status_code, 200)
    #     frequencies = response.json()["catalog_document"]["frequencies"]
    #     self.assertEqual(
    #         [{"frequency": "1x měsíčně", "date": None}], frequencies
    #     )

    #     response = self.client.post(
    #         "/catalogs",
    #         json={"identifier_type": "Sysno", "value": sysno2},
    #     )
    #     self.assertEqual(response.status_code, 200)
    #     frequencies = response.json()["catalog_document"]["frequencies"]
    #     self.assertEqual(
    #         [
    #             {"frequency": "1x týdně", "date": "Od roč. 1, č. 47 (1945)"},
    #             {"frequency": "2x týdně", "date": "Roč. 1, č. 1-46 (1945)"},
    #         ],
    #         frequencies,
    #     )

    # def test_serialize_frequency(self):
    #     from catalogs.schemas import Frequency
    #     from documents.crud import get_document

    #     sysno = "MZK01-000165329"
    #     volume = "39"
    #     barcode = "2619868037"

    #     self.delete_document(sysno, volume, barcode)

    #     response = self.client.post(
    #         "/catalogs",
    #         params={"insert_digitized": ["true"]},
    #         json={"identifier_type": "Barcode", "value": barcode},
    #     )
    #     self.assertEqual(response.status_code, 200)
    #     id = response.json()["document"]["id"]

    #     document = get_document(id, self.db)
    #     print([Frequency(**freq) for freq in document.frequencies])

    # def test_search_query(self):
    #     from documents.crud import (
    #         create_document,
    #         delete_document,
    #         get_documents_query_base,
    #         get_documents,
    #         get_documents_num_found,
    #     )
    #     from documents.schemas import (
    #         DocumentCreate,
    #         DocumentsQuery,
    #         SearchGroup,
    #         SearchField,
    #         GroupOption,
    #         TextOption,
    #         DocumentField,
    #     )

    #     document = DocumentCreate(
    #         sysno="MZK01-001002003",
    #         volume_number="1996",
    #         title="Test Document",
    #     )
    #     document = create_document(document, "test", self.db)

    #     query = DocumentsQuery(
    #         search_group=SearchGroup(
    #             option=GroupOption.MatchAll,
    #             sub_rules=[
    #                 SearchField(
    #                     field=DocumentField.Title,
    #                     option=TextOption.StartsWith,
    #                     value="Test",
    #                 )
    #             ],
    #         )
    #     )

    #     base = get_documents_query_base(self.db, query)

    #     get_documents(base)
    #     get_documents_num_found(base)
    #     delete_document(document.id, self.db)

    # def test_update_category_by_query(self):
    #     from categories.crud import create_root_category, delete_category
    #     from categories.schemas import CategoryCreate
    #     from documents.crud import (
    #         create_document,
    #         delete_document,
    #         get_documents_query_base,
    #         get_documents,
    #         get_documents_num_found,
    #         update_documents,
    #     )
    #     from documents.schemas import (
    #         DocumentCreate,
    #         DocumentsQuery,
    #     )

    #     category_id = create_root_category(
    #         CategoryCreate(name="test category", assignable=True), self.db
    #     ).id

    #     document_ids = []
    #     document = DocumentCreate(
    #         sysno="MZK01-001002003",
    #         volume_number="1996",
    #         title="Test Document",
    #         category_id=category_id,
    #     )
    #     document_ids.append(create_document(document, "test", self.db).id)
    #     document = DocumentCreate(
    #         sysno="MZK01-001002003",
    #         volume_number="1997",
    #         title="Test Document",
    #         category_id=category_id,
    #     )
    #     document_ids.append(create_document(document, "test", self.db).id)

    #     query = DocumentsQuery(id_list=document_ids)

    #     base = get_documents_query_base(self.db, query)

    #     documents = get_documents(base)
    #     for document in documents:
    #         self.assertEqual(document.category_id, category_id)
    #     self.assertEqual(get_documents_num_found(base), 2)

    #     update_documents(base, "category_id", None, self.db)

    #     documents = get_documents(base)
    #     for document in documents:
    #         self.assertEqual(document.category_id, None)
    #     self.assertEqual(get_documents_num_found(base), 2)

    #     for document_id in document_ids:
    #         delete_document(document_id, self.db)
    #     delete_category(category_id, self.db)

    # def test_delete_category_by_query(self):
    #     from documents.crud import (
    #         create_document,
    #         get_documents_query_base,
    #         get_documents_num_found,
    #         delete_documents,
    #     )
    #     from documents.schemas import (
    #         DocumentCreate,
    #         DocumentsQuery,
    #     )

    #     document_ids = []
    #     document = DocumentCreate(
    #         sysno="MZK01-001002003",
    #         volume_number="1996",
    #         title="Test Document",
    #     )
    #     document_ids.append(create_document(document, "test", self.db).id)
    #     document = DocumentCreate(
    #         sysno="MZK01-001002003",
    #         volume_number="1997",
    #         title="Test Document",
    #     )
    #     document_ids.append(create_document(document, "test", self.db).id)

    #     query = DocumentsQuery(id_list=document_ids)

    #     base = get_documents_query_base(self.db, query)

    #     self.assertEqual(get_documents_num_found(base), 2)

    #     delete_documents(base, self.db)

    #     base = get_documents_query_base(self.db, query)
    #     self.assertEqual(get_documents_num_found(base), 0)
