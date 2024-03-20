from tests.test_routines import TestRoutines
from unittest.mock import Mock, patch
from typing import List, Optional

from categories.models import Category
from extractions.routines import generate_extraction, bottom_up_generator
from extractions.schemas import DocumentPagesCount, ExtractionCreate

from extractions.extraction_node import ExtractionNode
from extractions.preparation import generate_extraction_tree


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

    @patch("categories.crud.get_assignable_categories")
    @patch("categories.crud.get_category")
    def test_bottom_up_generator(
        self, mock_get_category: Mock, mock_get_assignable_categories: Mock
    ):
        from extractions.routines import CategoryLeaf

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
            percentage=30,
            parent_id=1,
        )
        category_child13 = Category(
            id=5,
            name="Child 13",
            assignable=True,
            percentage=20,
            parent_id=1,
        )
        category_grandchild111 = Category(
            id=6,
            name="Grandchild 111",
            assignable=True,
            percentage=50,
            parent_id=3,
        )
        category_grandgrandchild112 = Category(
            id=7,
            name="Grandchild 112",
            assignable=True,
            percentage=50,
            parent_id=3,
        )
        category_child21 = Category(
            id=8,
            name="Child 21",
            assignable=True,
            percentage=50,
            parent_id=2,
        )
        category_child22 = Category(
            id=9,
            name="Child 22",
            assignable=False,
            percentage=50,
            parent_id=2,
        )

        mock_get_assignable_categories.return_value = [
            category_child12,
            category_child13,
            category_grandchild111,
            category_grandgrandchild112,
            category_child21,
        ]

        mock_get_category.side_effect = lambda id, db: {
            1: category_root1,
            2: category_root2,
            3: category_child11,
            4: category_child12,
            5: category_child13,
            6: category_grandchild111,
            7: category_grandgrandchild112,
            8: category_child21,
            9: category_child22,
        }.get(id)

        # Act
        categories: List[CategoryLeaf] = bottom_up_generator(100, self.db)

        # Assert
        def get_category_target_pages(category_id: int) -> Optional[int]:
            target_pages = [
                c.target_pages
                for c in categories
                if c.category.id == category_id
            ]
            return target_pages[0] if target_pages else None

        self.assertIsNone(get_category_target_pages(1))
        self.assertIsNone(get_category_target_pages(2))
        self.assertIsNone(get_category_target_pages(3))
        self.assertEqual(get_category_target_pages(4), 18)
        self.assertEqual(get_category_target_pages(5), 12)
        self.assertEqual(get_category_target_pages(6), 15)
        self.assertEqual(get_category_target_pages(7), 15)
        self.assertEqual(get_category_target_pages(8), 40)
        self.assertIsNone(get_category_target_pages(9))


class TestExtractionsPreparation(TestRoutines):
    @patch("extractions.preparation.get_root_categories")
    @patch("extractions.preparation.get_children_categories")
    @patch("extractions.preparation.get_extractable_documents_count")
    def test_extraction_tree_generator(
        self,
        mock_get_extractable_documents_count: Mock,
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
            percentage=30,
            parent_id=1,
        )
        category_child13 = Category(
            id=5,
            name="Child 13",
            assignable=True,
            percentage=20,
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

        mock_get_extractable_documents_count.side_effect = lambda id, db: {
            1: 0,
            2: 0,
            3: 0,
            4: 181,
            5: 272,
            6: 316,
            7: 446,
            8: 234,
            9: 0,
        }.get(id)

        target_pages = [
            (0, 100),
            (1, 60),
            (3, 30),
            (6, 18),
            (7, 12),
            (4, 18),
            (5, 12),
            (2, 40),
            (8, 10),
            (9, 0),
        ]

        # Act
        root: ExtractionNode = generate_extraction_tree(100.0, self.db)

        # Assert
        index = 0

        def assert_nodes_order_and_target_pages(node: ExtractionNode):
            nonlocal index
            self.assertEqual(node.category_id, target_pages[index][0])
            self.assertEqual(node.target_pages, target_pages[index][1])
            index += 1
            while not node.children_queue.empty():
                child = node.children_queue.get()
                assert_nodes_order_and_target_pages(child)

        assert_nodes_order_and_target_pages(root)
