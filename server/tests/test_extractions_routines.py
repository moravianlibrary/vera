from tests.test_routines import TestRoutines
from unittest.mock import Mock, patch

from categories.models import Category
from documents.models import Document as DocumentModel
from extractions.generator import ExtractionGenerator
from extractions.schemas import ExtractionCreate

from extractions.extraction_node import ExtractionNode, ExtractionRoot
from extractions.preprocessor import ExtractionPreprocessor


class TestExtractionsRoutines(TestRoutines):
    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_one_document_exact_pages_count(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(10, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_one_document_higher_pages_count_inside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(10, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_one_document_lower_pages_count_outside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(9, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_one_document_lower_pages_count_inside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(
            11, ExtractionCreate(target_pages_threshold=0.1), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_whole_category_exact_pages_count(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(10, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_whole_category_lower_pages_count_inside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(11, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_whole_category_lower_pages_count_outside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(9, ExtractionCreate(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_whole_category_higher_pages_count_inside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(
            9, ExtractionCreate(whole_categories_threshold=0.2), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extract_whole_category_higher_pages_count_outside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(
            9, ExtractionCreate(whole_categories_threshold=0.1), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)


class TestExtractionsPreparation(TestRoutines):
    @patch("extractions.preprocessor.get_root_categories")
    @patch("extractions.preprocessor.get_children_categories")
    @patch("extractions.preprocessor.get_extractable_documents")
    def test_extraction_tree_generator(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        category_root1 = Category(
            id=1,
            name="Root 1",
            assignable=False,
            percentage=60,
            parent_id=None,
        )
        category_root2 = Category(
            id=2,
            name="Root 2",
            assignable=False,
            percentage=40,
            parent_id=None,
        )
        category_child11 = Category(
            id=3,
            name="Child 11",
            assignable=False,
            percentage=50,
            parent_id=1,
        )
        category_child12 = Category(
            id=4,
            name="Child 12",
            assignable=True,
            percentage=20,
            parent_id=1,
        )
        category_child13 = Category(
            id=5,
            name="Child 13",
            assignable=True,
            percentage=30,
            parent_id=1,
        )
        category_grandchild111 = Category(
            id=6,
            name="Grandchild 111",
            assignable=True,
            percentage=60,
            parent_id=3,
        )
        category_grandgrandchild112 = Category(
            id=7,
            name="Grandchild 112",
            assignable=True,
            percentage=40,
            parent_id=3,
        )
        category_child21 = Category(
            id=8,
            name="Child 21",
            assignable=True,
            percentage=25,
            parent_id=2,
        )
        category_child22 = Category(
            id=9,
            name="Child 22",
            assignable=False,
            percentage=75,
            parent_id=2,
        )

        mock_get_root_categories.return_value = [
            category_root1,
            category_root2,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [category_child11, category_child12, category_child13],
            2: [category_child21, category_child22],
            3: [category_grandchild111, category_grandgrandchild112],
            4: [],
            5: [],
            6: [],
            7: [],
            8: [],
            9: [],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [],
            4: [DocumentModel(id=4, pages_count=181)],
            5: [DocumentModel(id=5, pages_count=270)],
            6: [DocumentModel(id=6, pages_count=316)],
            7: [DocumentModel(id=7, pages_count=446)],
            8: [DocumentModel(id=8, pages_count=234)],
            9: [],
        }.get(id)

        categories_order = [1, 3, 6, 7, 5, 4, 2, 8]
        relative_ratios = [0.6, 0.5, 0.6, 0.4, 0.3, 0.2, 0.4, 1.0]
        overall_target_pages = 1200
        target_pages = [720.0, 360.0, 216.0, 144.0, 216.0, 144.0, 480.0, 480.0]

        # Act
        preprocessor = ExtractionPreprocessor(ExtractionCreate(), self.db)
        root: ExtractionRoot = preprocessor.generate_extraction_tree()

        # Assert
        index = 0

        def assert_nodes_order_and_target_pages(node: ExtractionNode):
            nonlocal index
            self.assertEqual(node.category_id, categories_order[index])
            self.assertEqual(node.relative_ratio, relative_ratios[index])
            self.assertEqual(
                node.get_relative_target_pages(overall_target_pages),
                target_pages[index],
            )
            index += 1
            while not node.main_queue.empty():
                assert_nodes_order_and_target_pages(node.main_queue.get())

        self.assertEqual(root.relative_ratio, 1.0)
        while not root.main_queue.empty():
            assert_nodes_order_and_target_pages(root.main_queue.get())
