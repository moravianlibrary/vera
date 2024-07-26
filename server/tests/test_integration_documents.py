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
    #     from schemas import Frequency
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

    # def test_search_query(self):
    #     from documents.crud import (
    #         create_document,
    #         delete_document,
    #         get_documents_query_base,
    #         get_documents,
    #         get_documents_num_found,
    #     )
    #     from schemas import (
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
    #     from schemas import CategoryCreate
    #     from documents.crud import (
    #         create_document,
    #         delete_document,
    #         get_documents_query_base,
    #         get_documents,
    #         get_documents_num_found,
    #         update_documents,
    #     )
    #     from schemas import (
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
    #     from schemas import (
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
