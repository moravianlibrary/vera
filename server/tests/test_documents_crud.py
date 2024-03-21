from tests.test_crud_operations import TestCrudOperations

from documents import crud
from documents.schemas import DocumentCreate
from documents.models import Document


class TestDocumentsCrud(TestCrudOperations):
    def test_create(self):
        # Arrange
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume="1996",
            title="Test Document",
        )

        # Act
        db_document: Document = crud.create_document(
            document,
            "Test User",
            self.db,
        )

        # Assert
        self.assertIsNotNone(db_document.id)
        self.assertEqual(document.title, "Test Document")

    def test_update(self):
        # Arrange
        document: Document = crud.create_document(
            DocumentCreate(
                sysno="MZK01-001002003",
                volume="1996",
                title="Test Document",
            ),
            "test_user",
            self.db,
        )
        document_id = document.id

        # Act
        document = crud.update_document(
            document.id,
            DocumentCreate(title="Test Document Updated"),
            "test_user",
            self.db,
        )

        # Assert
        self.assertEqual(document.id, document_id)
        self.assertEqual(document.title, "Test Document Updated")

    def test_document_exists(self):
        # Arrange
        document = DocumentCreate(
            sysno="MZK01-001002003",
            volume="1996",
            title="Test Document",
        )
        crud.create_document(
            document,
            "Test User",
            self.db,
        )

        # Act
        exists = crud.document_exists(
            document.sysno, document.volume, document.barcode, self.db
        )

        # Assert
        self.assertTrue(exists)
