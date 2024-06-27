from tests.test_crud import TestCrudOperations

import crud.documents as crud
from schemas.documents import DocumentCreate
from models.documents import Document


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

    def test_update_with_edit_all_fields(self):
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
            True,
            self.db,
        )

        # Assert
        self.assertEqual(document.id, document_id)
        self.assertEqual(document.title, "Test Document Updated")

    def test_update_without_edit_all_fields(self):
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
            False,
            self.db,
        )

        # Assert
        self.assertEqual(document.id, document_id)
        self.assertEqual(document.title, "Test Document")

    def test_update_pages_count_manual_without_edit_all_fields(self):
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
            DocumentCreate(
                title="Test Document Updated", pages_count_manual=10
            ),
            False,
            self.db,
        )

        # Assert
        self.assertEqual(document.id, document_id)
        self.assertEqual(document.title, "Test Document")
        self.assertEqual(document.pages_count_manual, 10)

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
