from tests.test_routines import TestRoutines
from unittest.mock import Mock, patch

from categories.models import Category
from extractions.routines import generate_extraction
from extractions.schemas import DocumentPagesCount, ExtractionCreate


class TestExtractionsRoutines(TestRoutines):
    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    def test_extract_one_document_exact_pages_count(
        self,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]

        mock_get_category_documents.return_value = category_documents
        mock_get_root_categories.return_value = categories
        mock_get_assignable_categories.return_value = categories

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 10, self.db)

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    def test_extract_one_document_higher_pages_count_inside_threshold(
        self,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]

        mock_get_category_documents.return_value = category_documents
        mock_get_root_categories.return_value = categories
        mock_get_assignable_categories.return_value = categories

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 11, self.db)

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    def test_extract_one_document_lower_pages_count_outside_threshold(
        self,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]

        mock_get_category_documents.return_value = category_documents
        mock_get_root_categories.return_value = categories
        mock_get_assignable_categories.return_value = categories

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 9, self.db)

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    def test_extract_one_document_lower_pages_count_inside_threshold(
        self,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]

        mock_get_category_documents.return_value = category_documents
        mock_get_root_categories.return_value = categories
        mock_get_assignable_categories.return_value = categories

        # Act
        ids, count = generate_extraction(
            ExtractionCreate(target_pages_threshold=0.1), 11, self.db
        )

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_pages_count")
    def test_extract_whole_category_exact_pages_count(
        self,
        mock_get_pages_count: Mock,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        documents = [DocumentPagesCount(id=1, pages_count=10)]
        category = Category(
            id=1,
            name="Test",
            assignable=True,
            percentage=100,
            extract_whole=True,
        )

        mock_get_category_documents.return_value = documents
        mock_get_root_categories.return_value = [category]
        mock_get_assignable_categories.return_value = [category]
        mock_get_pages_count.return_value = 10

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 10, self.db)

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_pages_count")
    def test_extract_whole_category_lower_pages_count_inside_threshold(
        self,
        mock_get_pages_count: Mock,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        documents = [DocumentPagesCount(id=1, pages_count=10)]
        category = Category(
            id=1,
            name="Test",
            assignable=True,
            percentage=100,
            extract_whole=True,
        )

        mock_get_category_documents.return_value = documents
        mock_get_root_categories.return_value = [category]
        mock_get_assignable_categories.return_value = [category]
        mock_get_pages_count.return_value = 10

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 11, self.db)

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_pages_count")
    def test_extract_whole_category_lower_pages_count_outside_threshold(
        self,
        mock_get_pages_count: Mock,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        documents = [DocumentPagesCount(id=1, pages_count=10)]
        category = Category(
            id=1,
            name="Test",
            assignable=True,
            percentage=100,
            extract_whole=True,
        )

        mock_get_category_documents.return_value = documents
        mock_get_root_categories.return_value = [category]
        mock_get_assignable_categories.return_value = [category]
        mock_get_pages_count.return_value = 10

        # Act
        ids, count = generate_extraction(ExtractionCreate(), 9, self.db)

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_pages_count")
    def test_extract_whole_category_higher_pages_count_inside_threshold(
        self,
        mock_get_pages_count: Mock,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        documents = [DocumentPagesCount(id=1, pages_count=10)]
        category = Category(
            id=1,
            name="Test",
            assignable=True,
            percentage=100,
            extract_whole=True,
        )

        mock_get_category_documents.return_value = documents
        mock_get_root_categories.return_value = [category]
        mock_get_assignable_categories.return_value = [category]
        mock_get_pages_count.return_value = 10

        # Act
        ids, count = generate_extraction(
            ExtractionCreate(whole_categories_threshold=0.2), 9, self.db
        )

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.crud.get_category_documents")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_pages_count")
    def test_extract_whole_category_higher_pages_count_outside_threshold(
        self,
        mock_get_pages_count: Mock,
        mock_get_assignable_categories: Mock,
        mock_get_root_categories: Mock,
        mock_get_category_documents: Mock,
    ):
        # Arrange
        documents = [DocumentPagesCount(id=1, pages_count=10)]
        category = Category(
            id=1,
            name="Test",
            assignable=True,
            percentage=100,
            extract_whole=True,
        )

        mock_get_category_documents.return_value = documents
        mock_get_root_categories.return_value = [category]
        mock_get_assignable_categories.return_value = [category]
        mock_get_pages_count.return_value = 10

        # Act
        ids, count = generate_extraction(
            ExtractionCreate(whole_categories_threshold=0.1), 9, self.db
        )

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)
