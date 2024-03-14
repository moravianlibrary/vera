import unittest
from fastapi.testclient import TestClient
from helper_funcs import get_admin_token, mockClsEnv


class TestDocumentsCrud(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):

        from services.database import get_db

        self.db = next(get_db())

    def test_create_delete(self):
        from documents.crud import create_document, delete_document
        from documents.schemas import DocumentCreate
        from documents.models import Document

        document: Document = create_document(
            DocumentCreate(
                sysno="MZK01-001002003",
                volume="1996",
                title="Test Document",
            ),
            "test_user",
            self.db,
        )
        self.assertIsNotNone(document.id)
        delete_document(document.id, self.db)

    def test_update(self):
        from documents.crud import (
            create_document,
            update_document,
            delete_document,
        )
        from documents.schemas import DocumentCreate
        from documents.models import Document

        document: Document = create_document(
            DocumentCreate(
                sysno="MZK01-001002003",
                volume="1996",
                title="Test Document",
            ),
            "test_user",
            self.db,
        )
        self.assertIsNotNone(document.id)
        self.assertEqual(document.title, "Test Document")

        document = update_document(
            document.id,
            DocumentCreate(title="Test Document Updated"),
            "test_user",
            self.db,
        )
        self.assertEqual(document.title, "Test Document Updated")

        delete_document(document.id, self.db)

    def test_document_exists(self):
        from documents.crud import (
            create_document,
            delete_document,
            document_exists,
        )
        from documents.schemas import DocumentCreate
        from documents.models import Document

        sysno = "MZK01-001002003"
        volume = "1996"
        title = "Test Document"
        document: Document = create_document(
            DocumentCreate(
                sysno=sysno,
                volume=volume,
                title=title,
            ),
            "test_user",
            self.db,
        )
        self.assertIsNotNone(document.id)
        self.assertTrue(document_exists(sysno, volume, None, self.db))
        delete_document(document.id, self.db)


class TestDocumentsEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        from vera import app

        self.client = TestClient(app)
        from services.database import get_db

        self.db = next(get_db())

        self.headers = {
            "Authorization": f"Bearer {get_admin_token()}",
            "Content-Type": "application/json",
        }

        self.test_sysno = "MZK01-001002003"
        self.test_volume = "1996"
        self.test_title = "Test Document"

    def create_test_document(self):
        document = {
            "sysno": self.test_sysno,
            "volume": self.test_volume,
            "title": self.test_title,
        }
        self.delete_document(self.test_sysno, self.test_volume, None)
        return self.client.post(
            "/documents", json=document, headers=self.headers
        )

    def delete_document(self, sysno, volume, barcode):
        from documents.crud import get_document_by_identifiers, delete_document

        document = get_document_by_identifiers(sysno, volume, barcode, self.db)
        if document is not None:
            delete_document(document.id, self.db)

    def document_exists(self, sysno, volume, barcode):
        from documents.crud import get_document_by_identifiers

        return (
            get_document_by_identifiers(sysno, volume, barcode, self.db)
            is not None
        )

    def test_create_delete_document(self):
        from documents.enums import DocumentCreateResult

        response = self.create_test_document()

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(
            response.json()["create_result"], DocumentCreateResult.Success
        )

        document = response.json()["document"]
        self.assertTrue("id" in document)
        self.assertEqual(self.test_sysno, document["sysno"])
        self.assertEqual(self.test_volume, document["volume"])
        self.assertEqual(self.test_title, document["title"])

        self.client.delete(f"/documents/{document['id']}")

    def test_update_document(self):
        from documents.enums import DocumentCreateResult

        response = self.create_test_document()
        self.assertEqual(
            response.json()["create_result"],
            DocumentCreateResult.Success.value,
        )

        document = response.json()["document"]
        document["title"] = "Test Document Updated"

        response = self.client.put(
            f"/documents/{document['id']}", json=document, headers=self.headers
        )

        self.assertEqual(response.status_code, 200)
        document = response.json()
        self.assertTrue("id" in document)
        self.assertEqual(self.test_sysno, document["sysno"])
        self.assertEqual(self.test_volume, document["volume"])
        self.assertEqual("Test Document Updated", document["title"])

        self.client.delete(f"/documents/{response.json()['id']}")

    def test_get_from_catalog(self):
        from catalogs.enums import CatalogResponseStatus, DigitizationState

        headers = {"Authorization": f"Bearer {get_admin_token()}"}

        response = self.client.get(
            "/catalogs",
            params={"identifier_type": ["Sysno"], "value": ["mzk03001066272"]},
            headers=headers,
        )

        self.assertEqual(response.status_code, 200)
        catalog_response = response.json()
        document = catalog_response["document"]
        response_status = catalog_response["response_status"]

        self.assertEqual(response_status, CatalogResponseStatus.Success.value)
        self.assertEqual("2610417932", document["barcode"])
        self.assertEqual(
            DigitizationState.NotDigitized.value,
            document["digitization_state"],
        )

    def test_get_from_catalog_from_file(self):
        from catalogs.enums import CatalogResponseStatus, DigitizationState

        test_file_path = "tests/sysnos_test_file.txt"

        headers = {"Authorization": f"Bearer {get_admin_token()}"}
        with open(test_file_path, "rb") as file:
            values = [
                line
                for line in file.read().decode("utf-8").split("\n")
                if line
            ]

        response = self.client.get(
            "/catalogs/list",
            params={"identifier_type": "Sysno", "values": values},
            headers=headers,
        )

        self.assertEqual(response.status_code, 200)
        catalog_response = response.json()
        print(catalog_response)
        self.assertEqual(
            "2610417932", catalog_response[0]["document"]["barcode"]
        )
        self.assertEqual(
            DigitizationState.NotDigitized.value,
            catalog_response[0]["document"]["digitization_state"],
        )
        self.assertEqual(
            "2619088071", catalog_response[1]["document"]["barcode"]
        )
        self.assertEqual(
            DigitizationState.Finished.value,
            catalog_response[1]["document"]["digitization_state"],
        )
        self.assertIsNone(catalog_response[2]["document"])
        self.assertEqual(
            CatalogResponseStatus.InvalidSysno.value,
            catalog_response[2]["response_status"],
        )
        self.assertIsNone(catalog_response[3]["document"])
        self.assertEqual(
            CatalogResponseStatus.InvalidSysnoBase.value,
            catalog_response[3]["response_status"],
        )
        self.assertIsNone(catalog_response[4]["document"])
        self.assertEqual(
            (CatalogResponseStatus.DocumentNotFound.value),
            catalog_response[4]["response_status"],
        )

    def test_create_from_catalog_from_file(self):
        from catalogs.enums import DigitizationState
        from documents.enums import DocumentCreateResult

        self.delete_document("MZK03-001066272", None, None)
        self.delete_document("MZK01-001479397", None, None)

        test_file_path = "tests/sysnos_test_file.txt"

        headers = {"Authorization": f"Bearer {get_admin_token()}"}
        with open(test_file_path, "rb") as file:
            values = [
                line
                for line in file.read().decode("utf-8").split("\n")
                if line
            ]

        response = self.client.post(
            "/catalogs/list",
            params={"identifier_type": "Sysno", "values": values},
            headers=headers,
        )

        self.assertEqual(response.status_code, 200)
        create_response = response.json()
        self.assertEqual(
            "2610417932", create_response[0]["document"]["barcode"]
        )
        (create_response[0]["document"]["id"], self.db)
        self.assertEqual(
            DigitizationState.NotDigitized.value,
            create_response[0]["document"]["digitization_state"],
        )
        self.assertEqual(
            "2619088071", create_response[1]["document"]["barcode"]
        )
        self.assertEqual(
            DigitizationState.Finished.value,
            create_response[1]["document"]["digitization_state"],
        )
        self.assertIsNone(create_response[2]["document"])
        self.assertEqual(
            DocumentCreateResult.InvalidSysno.value,
            create_response[2]["create_result"],
        )
        self.assertIsNone(create_response[3]["document"])
        self.assertEqual(
            DocumentCreateResult.InvalidSysnoBase.value,
            create_response[3]["create_result"],
        )
        self.assertIsNone(create_response[4]["document"])
        self.assertEqual(
            DocumentCreateResult.DocumentNotFoundInCatalog.value,
            create_response[4]["create_result"],
        )

    def test_insert_by_sysno_with_some_issues_already_existing(self):
        sysno = "MZK01-000165329"
        volume = "39"
        barcode = "2619868037"

        self.delete_document(sysno, volume, barcode)

        headers = {"Authorization": f"Bearer {get_admin_token()}"}

        response = self.client.post(
            "/catalogs",
            params={"insert_digitized": ["true"]},
            json={"identifier_type": "Barcode", "value": barcode},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        create_response = response.json()
        document = create_response["document"]
        self.assertEqual("39", document["volume"])

        response = self.client.post(
            "/catalogs",
            json={"identifier_type": "Sysno", "value": sysno},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        create_response = response.json()
        for issue in create_response["catalog_document"]["issues"]:
            self.assertEqual(
                issue["barcode"] == barcode, issue["already_exists"]
            )

        self.assertEqual(
            document["locationUri"],
            "http://www.digitalniknihovna.cz/mzk/"
            "uuid/uuid:3e68f1f0-9d7f-11e4-a2db-005056825209",
        )

    def test_insert_with_frequencies(self):
        sysno1 = "MZK01-000165329"
        sysno2 = "MZK01-000230291"

        headers = {"Authorization": f"Bearer {get_admin_token()}"}

        response = self.client.post(
            "/catalogs",
            json={"identifier_type": "Sysno", "value": sysno1},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        frequencies = response.json()["catalog_document"]["frequencies"]
        self.assertEqual(
            [{"frequency": "1x měsíčně", "date": None}], frequencies
        )

        response = self.client.post(
            "/catalogs",
            json={"identifier_type": "Sysno", "value": sysno2},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        frequencies = response.json()["catalog_document"]["frequencies"]
        self.assertEqual(
            [
                {"frequency": "1x týdně", "date": "Od roč. 1, č. 47 (1945)"},
                {"frequency": "2x týdně", "date": "Roč. 1, č. 1-46 (1945)"},
            ],
            frequencies,
        )

    def test_serialize_frequency(self):
        from catalogs.schemas import Frequency
        from documents.crud import get_document

        sysno = "MZK01-000165329"
        volume = "39"
        barcode = "2619868037"

        self.delete_document(sysno, volume, barcode)

        headers = {"Authorization": f"Bearer {get_admin_token()}"}

        response = self.client.post(
            "/catalogs",
            params={"insert_digitized": ["true"]},
            json={"identifier_type": "Barcode", "value": barcode},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        id = response.json()["document"]["id"]

        document = get_document(id, self.db)
        print([Frequency(**freq) for freq in document.frequencies])

    def test_search_query(self):
        from documents.crud import (
            create_document,
            delete_document,
            get_documents_query_base,
            get_documents,
            get_documents_num_found,
        )
        from documents.schemas import (
            DocumentCreate,
            DocumentsQuery,
            SearchGroup,
            SearchField,
            GroupOption,
            TextOption,
            DocumentField,
        )

        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume_number="1996",
            title="Test Document",
        )
        document = create_document(document, "test", self.db)

        query = DocumentsQuery(
            search_group=SearchGroup(
                option=GroupOption.MatchAll,
                sub_rules=[
                    SearchField(
                        field=DocumentField.Title,
                        option=TextOption.StartsWith,
                        value="Test",
                    )
                ],
            )
        )

        base = get_documents_query_base(self.db, query)

        get_documents(base)
        get_documents_num_found(base)
        delete_document(document.id, self.db)

    def test_update_category_by_query(self):
        from categories.crud import create_root_category, delete_category
        from categories.schemas import CategoryCreate
        from documents.crud import (
            create_document,
            delete_document,
            get_documents_query_base,
            get_documents,
            get_documents_num_found,
            update_documents,
        )
        from documents.schemas import (
            DocumentCreate,
            DocumentsQuery,
        )

        category_id = create_root_category(
            CategoryCreate(name="test category", assignable=True), self.db
        ).id

        document_ids = []
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume_number="1996",
            title="Test Document",
            category_id=category_id,
        )
        document_ids.append(create_document(document, "test", self.db).id)
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume_number="1997",
            title="Test Document",
            category_id=category_id,
        )
        document_ids.append(create_document(document, "test", self.db).id)

        query = DocumentsQuery(id_list=document_ids)

        base = get_documents_query_base(self.db, query)

        documents = get_documents(base)
        for document in documents:
            self.assertEqual(document.category_id, category_id)
        self.assertEqual(get_documents_num_found(base), 2)

        update_documents(base, "category_id", None, self.db)

        documents = get_documents(base)
        for document in documents:
            self.assertEqual(document.category_id, None)
        self.assertEqual(get_documents_num_found(base), 2)

        for document_id in document_ids:
            delete_document(document_id, self.db)
        delete_category(category_id, self.db)

    def test_delete_category_by_query(self):
        from documents.crud import (
            create_document,
            get_documents_query_base,
            get_documents_num_found,
            delete_documents,
        )
        from documents.schemas import (
            DocumentCreate,
            DocumentsQuery,
        )

        document_ids = []
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume_number="1996",
            title="Test Document",
        )
        document_ids.append(create_document(document, "test", self.db).id)
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume_number="1997",
            title="Test Document",
        )
        document_ids.append(create_document(document, "test", self.db).id)

        query = DocumentsQuery(id_list=document_ids)

        base = get_documents_query_base(self.db, query)

        self.assertEqual(get_documents_num_found(base), 2)

        delete_documents(base, self.db)

        base = get_documents_query_base(self.db, query)
        self.assertEqual(get_documents_num_found(base), 0)


if __name__ == "__main__":
    unittest.main()
