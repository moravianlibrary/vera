import unittest
from fastapi.testclient import TestClient
from helper_funcs import get_admin_token, setUpEnv


class TestDocumentsModelsInit(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from services.database import get_db
        self.db = next(get_db())

    def create_document(self, sysno, volume_number, item_number):
        from documents.crud import create_document
        from documents.schemas import DocumentCreate
        return create_document(
            DocumentCreate(
                sysno=sysno,
                volume_number=volume_number,
                item_number=item_number,
                title="Test Title"
            ),
            creator_id=1,
            db=self.db
        )

    def delete_document(self, sysno, volume_number, item_number):
        from documents.crud import get_document_by_identifiers, delete_document
        document = get_document_by_identifiers(
            sysno, volume_number, item_number, self.db)
        delete_document(document.id, self.db)

    def document_exists(self, sysno, volume_number, item_number):
        from documents.crud import get_document_by_identifiers
        return get_document_by_identifiers(
            sysno, volume_number, item_number, self.db) is not None


class TestDocumentsEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())

        self.clean_documents()
        self.clean_categories()

        self.headers = {
            'Authorization': f'Bearer {get_admin_token()}',
            'Content-Type': 'application/json'
            }

        from categories.crud import create_root_category
        from categories.schemas import CategoryCreate
        category_name = "Test Category"

        self.category_id = create_root_category(CategoryCreate(
            name=category_name,
            assignable=True
        ), self.db).id

    def clean_documents(self):
        from documents.crud import get_documents_query_base, \
            get_documents, delete_document
        for document in get_documents(get_documents_query_base(self.db)):
            delete_document(document.id, self.db)

    def clean_categories(self):
        from categories.crud import get_root_categories, delete_category
        for category in get_root_categories(self.db):
            delete_category(category.id, self.db)

    def create_test_document(self):
        document = {
            "sysno": "MZK01-001002003",
            "volume_number": "1996",
            "title": "Test Document",
            "category_id": self.category_id
        }
        return self.client.post("/documents",
                                json=document,
                                headers=self.headers)

    def delete_document(self, sysno, volume_number):
        from documents.crud import get_document_by_identifiers, delete_document
        document = get_document_by_identifiers(
            sysno, volume_number, self.db)
        delete_document(document.id, self.db)

    def document_exists(self, sysno, volume_number, item_number):
        from documents.crud import get_document_by_identifiers
        return get_document_by_identifiers(
            sysno, volume_number, self.db) is not None

    def test_create_delete_document(self):
        from catalogs.enums import DocumentCreateResult
        response = self.create_test_document()

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()['create_result'],
                            DocumentCreateResult.SUCCESS)

        document = response.json()['document']
        self.assertTrue("id" in document)
        self.assertEqual("MZK01-001002003", document['sysno'])
        self.assertEqual("1996", document['volume_number'])
        self.assertEqual("Test Document", document['title'])

        self.client.delete(f"/documents/{document['id']}")

    def test_update_document(self):
        from catalogs.enums import DocumentCreateResult
        response = self.create_test_document()
        if response.json()['create_result'] != DocumentCreateResult.SUCCESS:
            self.delete_document("MZK01-001002003", "1996")
            response = self.create_test_document()

        document = response.json()['document']
        document['title'] = "Test Document Updated"

        response = self.client.put(f"/documents/{document['id']}",
                                   json=document,
                                   headers=self.headers)

        self.assertEqual(response.status_code, 200)
        document = response.json()
        self.assertTrue("id" in document)
        self.assertEqual("MZK01-001002003", document['sysno'])
        self.assertEqual("1996", document['volume_number'])
        self.assertEqual("Test Document Updated", document['title'])

        self.client.delete(f"/documents/{response.json()['id']}")

    def test_get_from_catalog(self):
        from catalogs.enums import DigitizationState

        headers = {
            'Authorization': f'Bearer {get_admin_token()}'
            }

        response = self.client.post(
            "/documents/get_from_catalog",
            json={'identifier_type': 'SYSNO',
                  'value': 'mzk03001066272'},
            headers=headers
        )

        self.assertEqual(response.status_code, 200)
        document = response.json()
        print(document)
        self.assertEqual("2610417932", document['document']['barcode'])
        self.assertEqual(DigitizationState.NOT_DIGITIZED.value,
                         document['digitization_state'])

    def test_get_from_catalog_from_file(self):
        from catalogs.enums import DigitizationState, DocumentCreateResult

        test_file_path = "tests/sysnos_test_file.txt"

        headers = {
            'Authorization': f'Bearer {get_admin_token()}'
            }

        response = self.client.post(
            "/documents/get_from_catalog_file",
            files={'file': open(test_file_path, 'rb')},
            headers=headers
        )

        self.assertEqual(response.status_code, 200)
        documents = response.json()
        print(documents)
        self.assertEqual("2610417932", documents[0]['document']['barcode'])
        self.assertEqual(DigitizationState.NOT_DIGITIZED.value,
                         documents[0]['digitization_state'])
        self.assertEqual("2619088071", documents[1]['document']['barcode'])
        self.assertEqual(DigitizationState.FINISHED.value,
                         documents[1]['digitization_state'])
        self.assertIsNone(documents[2]['document'])
        self.assertEqual(DocumentCreateResult.INVALID_SYSNO.value,
                         documents[2]['create_result'])
        self.assertIsNone(documents[3]['document'])
        self.assertEqual(DocumentCreateResult.INVALID_SYSNO_BASE.value,
                         documents[3]['create_result'])
        self.assertIsNone(documents[4]['document'])
        self.assertEqual((DocumentCreateResult
                          .DOCUMENT_NOT_FOUND_IN_CATALOG.value),
                         documents[4]['create_result'])

    def test_create_from_catalog_from_file(self):
        from catalogs.enums import DigitizationState, DocumentCreateResult
        from documents.crud import delete_document

        if self.document_exists("MZK03-001066272", None, None):
            self.delete_document("MZK03-001066272", None, None)
        if self.document_exists("MZK01-001479397", None, None):
            self.delete_document("MZK01-001479397", None, None)

        test_file_path = "tests/sysnos_test_file.txt"

        headers = {
            'Authorization': f'Bearer {get_admin_token()}'
            }

        response = self.client.post(
            "/documents/create_from_catalog_file",
            files={'file': open(test_file_path, 'rb')},
            headers=headers
        )

        self.assertEqual(response.status_code, 200)
        documents = response.json()
        print(documents)
        self.assertEqual("2610417932", documents[0]['document']['barcode'])
        delete_document(documents[0]['document']['id'], self.db)
        self.assertEqual(DigitizationState.NOT_DIGITIZED.value,
                         documents[0]['digitization_state'])
        # self.assertEqual("2619088071", documents[1]['document']['barcode'])
        self.assertEqual(DigitizationState.FINISHED.value,
                         documents[1]['digitization_state'])
        self.assertIsNone(documents[2]['document'])
        self.assertEqual(DocumentCreateResult.INVALID_SYSNO.value,
                         documents[2]['create_result'])
        self.assertIsNone(documents[3]['document'])
        self.assertEqual(DocumentCreateResult.INVALID_SYSNO_BASE.value,
                         documents[3]['create_result'])
        self.assertIsNone(documents[4]['document'])
        self.assertEqual(DocumentCreateResult
                         .DOCUMENT_NOT_FOUND_IN_CATALOG.value,
                         documents[4]['create_result'])


if __name__ == '__main__':
    unittest.main()
