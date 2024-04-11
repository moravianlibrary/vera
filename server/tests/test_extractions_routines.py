from tests.test_routines import TestRoutines
from unittest.mock import Mock, patch

from categories.models import Category
from documents.models import Document as DocumentModel
from extractions.generated.extraction_node import ExtractionNode
from extractions.generated.generator import ExtractionGenerator
from extractions.generated.schemas import GenerateExtraction
from extractions.generated.preprocessor import ExtractionPreprocessor


class TestExtractionsRoutines(TestRoutines):
    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
        generator = ExtractionGenerator(10, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
        generator = ExtractionGenerator(10, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extract_one_document_lower_pages_count_outside_threshold(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        mock_get_root_categories.return_value = [
            Category(
                id=1, name="test", assignable=True, percentage=100, level=0
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(9, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
            11, GenerateExtraction(target_pages_threshold=0.1), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
        generator = ExtractionGenerator(10, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
        generator = ExtractionGenerator(11, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
                level=0,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(9, GenerateExtraction(), self.db)
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
            9, GenerateExtraction(whole_categories_threshold=0.2), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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
                level=0,
            )
        ]
        mock_get_children_categories.return_value = []
        mock_get_extractable_documents.return_value = [
            DocumentModel(id=1, pages_count=10),
        ]

        # Act
        generator = ExtractionGenerator(
            9, GenerateExtraction(whole_categories_threshold=0.1), self.db
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)


class TestExtractionsPreparation(TestRoutines):
    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
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

        categories_order = [1, 3, 6, 7, 4, 5, 2, 8]
        relative_ratios = [0.6, 0.5, 0.6, 0.4, 0.2, 0.3, 0.4, 1.0]
        overall_target_pages = 1200
        target_pages = [720.0, 360.0, 216.0, 144.0, 144.0, 216.0, 480.0, 480.0]

        # Act
        preprocessor = ExtractionPreprocessor(GenerateExtraction(), self.db)
        root: ExtractionNode = preprocessor.generate_extraction_tree()

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
            for child in node.children:
                assert_nodes_order_and_target_pages(child)

        self.assertEqual(root.relative_ratio, 1.0)
        for child in root.children:
            assert_nodes_order_and_target_pages(child)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extraction(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        category_root1 = Category(
            id=1,
            name="Root 1",
            assignable=True,
            percentage=50,
            parent_id=None,
            level=0,
        )
        category_root2 = Category(
            id=2,
            name="Root 2",
            assignable=True,
            percentage=30,
            parent_id=None,
            level=0,
        )
        category_root3 = Category(
            id=3,
            name="Root 3",
            assignable=True,
            percentage=20,
            parent_id=None,
            level=0,
        )

        mock_get_root_categories.return_value = [
            category_root1,
            category_root2,
            category_root3,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [
                DocumentModel(id=1, pages_count=176),
                DocumentModel(id=2, pages_count=203),
                DocumentModel(id=3, pages_count=446),
            ],
            2: [
                DocumentModel(id=4, pages_count=270),
                DocumentModel(id=5, pages_count_predicted=27),
                DocumentModel(id=6, pages_count=316),
            ],
            3: [
                DocumentModel(id=7, pages_count=323),
                DocumentModel(id=8, pages_count=234),
                DocumentModel(id=9, pages_count=46),
            ],
        }.get(id)

        # Act
        generator = ExtractionGenerator(
            1200, GenerateExtraction(target_pages_threshold=0.05), self.db
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [8, 5, 6, 3, 1])
        self.assertEqual(count, 1199)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extraction_simple_tree(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        category_root1 = Category(
            id=1,
            name="Root 1",
            assignable=True,
            percentage=5,
            parent_id=None,
            level=0,
        )
        category_root2 = Category(
            id=2,
            name="Root 2",
            assignable=True,
            percentage=5,
            parent_id=None,
            level=0,
        )
        category_root3 = Category(
            id=3,
            name="Root 3",
            assignable=False,
            percentage=90,
            parent_id=None,
            level=0,
        )
        category_child31 = Category(
            id=4,
            name="Child 31",
            assignable=True,
            percentage=100,
            parent_id=None,
            level=1,
        )

        mock_get_root_categories.return_value = [
            category_root1,
            category_root2,
            category_root3,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [category_child31],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [
                DocumentModel(id=1, pages_count=176),
                DocumentModel(id=2, pages_count=151),
                DocumentModel(id=3, pages_count=446),
            ],
            2: [
                DocumentModel(id=4, pages_count=270),
                DocumentModel(id=5, pages_count_predicted=27),
                DocumentModel(id=6, pages_count=316),
            ],
            3: [],
            4: [
                DocumentModel(id=7, pages_count_predicted=500),
            ],
        }.get(id)

        # Act
        generator = ExtractionGenerator(
            1000, GenerateExtraction(target_pages_threshold=0.05), self.db
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [7, 5, 1, 4])
        self.assertEqual(count, 973)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extraction_complex_tree(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        odbor_periodik = Category(
            id=1,
            name="Odbor Periodik",
            assignable=False,
            percentage=10,
            parent_id=None,
            level=0,
        )
        morava = Category(
            id=2,
            name="Morava",
            assignable=False,
            percentage=20,
            parent_id=1,
            level=1,
        )
        noviny = Category(
            id=3,
            name="Noviny",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        casopisy = Category(
            id=4,
            name="Casopisy",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        vyrocni_zpravy = Category(
            id=5,
            name="Vyrocni Zpravy",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        kontinuita = Category(
            id=6,
            name="Kontinuita",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        dary = Category(
            id=7,
            name="Dary",
            assignable=True,
            percentage=35,
            parent_id=1,
            level=1,
        )
        projekty = Category(
            id=8,
            name="Projekty",
            assignable=False,
            percentage=10,
            parent_id=1,
            level=1,
        )
        alkaro = Category(
            id=9,
            name="Alkaro",
            assignable=True,
            percentage=100,
            parent_id=8,
            level=2,
        )
        test = Category(
            id=10,
            name="Test",
            assignable=False,
            percentage=5,
            parent_id=1,
            level=1,
        )
        category_root2 = Category(
            id=11,
            name="Root 2",
            assignable=False,
            percentage=90,
            parent_id=None,
            level=0,
        )
        category_child21 = Category(
            id=12,
            name="Child 21",
            assignable=True,
            percentage=100,
            parent_id=11,
            level=1,
        )

        mock_get_root_categories.return_value = [
            odbor_periodik,
            category_root2,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [morava, vyrocni_zpravy, kontinuita, dary, projekty, test],
            2: [noviny, casopisy],
            3: [],
            4: [],
            5: [],
            6: [],
            7: [],
            8: [alkaro],
            9: [],
            10: [],
            11: [category_child21],
            12: [],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [
                DocumentModel(id=1, pages_count=31),
                DocumentModel(id=2, pages_count=464),
                DocumentModel(id=3, pages_count=652),
                DocumentModel(id=4, pages_count=800),
                DocumentModel(id=5, pages_count=30),
                DocumentModel(id=6, pages_count=257),
                DocumentModel(id=7, pages_count=846),
                DocumentModel(id=8, pages_count=137),
                DocumentModel(id=9, pages_count=856),
                DocumentModel(id=10, pages_count=654),
                DocumentModel(id=11, pages_count=731),
                DocumentModel(id=12, pages_count=572),
                DocumentModel(id=13, pages_count=711),
                DocumentModel(id=14, pages_count=832),
                DocumentModel(id=15, pages_count=736),
                DocumentModel(id=16, pages_count=375),
                DocumentModel(id=17, pages_count=426),
                DocumentModel(id=18, pages_count=831),
                DocumentModel(id=19, pages_count=277),
                DocumentModel(id=20, pages_count=374),
                DocumentModel(id=21, pages_count=460),
                DocumentModel(id=22, pages_count=802),
                DocumentModel(id=23, pages_count=94),
                DocumentModel(id=24, pages_count=104),
                DocumentModel(id=25, pages_count=623),
            ],
            4: [
                DocumentModel(id=26, pages_count=768),
                DocumentModel(id=27, pages_count=129),
                DocumentModel(id=28, pages_count=309),
                DocumentModel(id=29, pages_count=689),
                DocumentModel(id=30, pages_count=915),
                DocumentModel(id=31, pages_count=560),
            ],
            5: [
                DocumentModel(id=32, pages_count=596),
                DocumentModel(id=33, pages_count=372),
                DocumentModel(id=34, pages_count=184),
                DocumentModel(id=35, pages_count=409),
                DocumentModel(id=36, pages_count=620),
                DocumentModel(id=37, pages_count=327),
                DocumentModel(id=38, pages_count=530),
                DocumentModel(id=39, pages_count=233),
                DocumentModel(id=40, pages_count=831),
            ],
            6: [
                DocumentModel(id=41, pages_count=374),
                DocumentModel(id=42, pages_count=655),
                DocumentModel(id=43, pages_count=186),
                DocumentModel(id=44, pages_count=544),
                DocumentModel(id=45, pages_count=606),
                DocumentModel(id=46, pages_count=351),
                DocumentModel(id=47, pages_count=711),
                DocumentModel(id=48, pages_count=493),
                DocumentModel(id=49, pages_count=292),
                DocumentModel(id=50, pages_count=885),
                DocumentModel(id=51, pages_count=837),
                DocumentModel(id=52, pages_count=486),
                DocumentModel(id=53, pages_count=687),
                DocumentModel(id=54, pages_count=113),
                DocumentModel(id=55, pages_count=167),
                DocumentModel(id=56, pages_count=158),
                DocumentModel(id=57, pages_count=218),
            ],
            7: [
                DocumentModel(id=58, pages_count=400),
                DocumentModel(id=59, pages_count=696),
                DocumentModel(id=60, pages_count=712),
                DocumentModel(id=61, pages_count=789),
                DocumentModel(id=62, pages_count=125),
                DocumentModel(id=63, pages_count=95),
                DocumentModel(id=64, pages_count=833),
                DocumentModel(id=65, pages_count=358),
                DocumentModel(id=66, pages_count=197),
                DocumentModel(id=67, pages_count=315),
                DocumentModel(id=68, pages_count=740),
                DocumentModel(id=69, pages_count=814),
                DocumentModel(id=70, pages_count=423),
                DocumentModel(id=71, pages_count=979),
                DocumentModel(id=72, pages_count=89),
                DocumentModel(id=73, pages_count=881),
                DocumentModel(id=74, pages_count=424),
                DocumentModel(id=75, pages_count=286),
                DocumentModel(id=76, pages_count=848),
                DocumentModel(id=77, pages_count=276),
                DocumentModel(id=78, pages_count=36),
                DocumentModel(id=79, pages_count=483),
                DocumentModel(id=80, pages_count=705),
            ],
            8: [],
            9: [
                DocumentModel(id=81, pages_count=939),
                DocumentModel(id=82, pages_count=540),
                DocumentModel(id=83, pages_count=709),
                DocumentModel(id=84, pages_count=159),
                DocumentModel(id=85, pages_count=372),
                DocumentModel(id=86, pages_count=16),
                DocumentModel(id=87, pages_count=572),
                DocumentModel(id=88, pages_count=551),
                DocumentModel(id=89, pages_count=788),
                DocumentModel(id=90, pages_count=30),
                DocumentModel(id=91, pages_count=756),
                DocumentModel(id=92, pages_count=709),
                DocumentModel(id=93, pages_count=455),
                DocumentModel(id=94, pages_count=462),
                DocumentModel(id=95, pages_count=859),
                DocumentModel(id=96, pages_count=344),
                DocumentModel(id=97, pages_count=209),
                DocumentModel(id=98, pages_count=398),
                DocumentModel(id=99, pages_count=171),
            ],
            10: [],
            11: [],
            12: [
                DocumentModel(id=100, pages_count_predicted=500),
            ],
        }.get(id)

        # Act
        generator = ExtractionGenerator(
            10000, GenerateExtraction(target_pages_threshold=0.05), self.db
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(
            ids,
            [
                100,
                27,
                28,
                31,
                87,
                90,
                98,
                35,
                37,
                38,
                39,
                58,
                59,
                60,
                61,
                69,
                72,
                42,
                53,
                56,
                1,
                2,
                5,
                19,
                23,
                24,
            ],
        )
        self.assertEqual(count, 9997)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extraction_complex_tree_extract_fully(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        odbor_periodik = Category(
            id=1,
            name="Odbor Periodik",
            assignable=False,
            percentage=10,
            parent_id=None,
            level=0,
        )
        morava = Category(
            id=2,
            name="Morava",
            assignable=False,
            percentage=20,
            parent_id=1,
            level=1,
        )
        noviny = Category(
            id=3,
            name="Noviny",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        casopisy = Category(
            id=4,
            name="Casopisy",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        vyrocni_zpravy = Category(
            id=5,
            name="Vyrocni Zpravy",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        kontinuita = Category(
            id=6,
            name="Kontinuita",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        dary = Category(
            id=7,
            name="Dary",
            assignable=True,
            percentage=35,
            parent_id=1,
            level=1,
        )
        projekty = Category(
            id=8,
            name="Projekty",
            assignable=False,
            percentage=10,
            parent_id=1,
            level=1,
        )
        alkaro = Category(
            id=9,
            name="Alkaro",
            assignable=True,
            percentage=100,
            parent_id=8,
            level=2,
        )
        test = Category(
            id=10,
            name="Test",
            assignable=False,
            percentage=5,
            parent_id=1,
            level=1,
        )
        category_root2 = Category(
            id=11,
            name="Root 2",
            assignable=False,
            percentage=90,
            parent_id=None,
            level=0,
        )
        category_child21 = Category(
            id=12,
            name="Child 21",
            assignable=True,
            percentage=100,
            parent_id=11,
            level=1,
        )

        mock_get_root_categories.return_value = [
            odbor_periodik,
            category_root2,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [morava, vyrocni_zpravy, kontinuita, dary, projekty, test],
            2: [noviny, casopisy],
            3: [],
            4: [],
            5: [],
            6: [],
            7: [],
            8: [alkaro],
            9: [],
            10: [],
            11: [category_child21],
            12: [],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [
                DocumentModel(id=1, pages_count=31),
                DocumentModel(id=2, pages_count=464),
                DocumentModel(id=3, pages_count=652),
                DocumentModel(id=4, pages_count=800),
                DocumentModel(id=5, pages_count=30),
                DocumentModel(id=6, pages_count=257),
                DocumentModel(id=7, pages_count=846),
                DocumentModel(id=8, pages_count=137),
                DocumentModel(id=9, pages_count=856),
                DocumentModel(id=10, pages_count=654),
                DocumentModel(id=11, pages_count=731),
                DocumentModel(id=12, pages_count=572),
                DocumentModel(id=13, pages_count=711),
                DocumentModel(id=14, pages_count=832),
                DocumentModel(id=15, pages_count=736),
                DocumentModel(id=16, pages_count=375),
                DocumentModel(id=17, pages_count=426),
                DocumentModel(id=18, pages_count=831),
                DocumentModel(id=19, pages_count=277),
                DocumentModel(id=20, pages_count=374),
                DocumentModel(id=21, pages_count=460),
                DocumentModel(id=22, pages_count=802),
                DocumentModel(id=23, pages_count=94),
                DocumentModel(id=24, pages_count=104),
                DocumentModel(id=25, pages_count=623),
            ],
            4: [
                DocumentModel(id=26, pages_count=768),
                DocumentModel(id=27, pages_count=129),
                DocumentModel(id=28, pages_count=309),
                DocumentModel(id=29, pages_count=689),
                DocumentModel(id=30, pages_count=915),
                DocumentModel(id=31, pages_count=560),
            ],
            5: [
                DocumentModel(id=32, pages_count=596),
                DocumentModel(id=33, pages_count=372),
                DocumentModel(id=34, pages_count=184),
                DocumentModel(id=35, pages_count=409),
                DocumentModel(id=36, pages_count=620),
                DocumentModel(id=37, pages_count=327),
                DocumentModel(id=38, pages_count=530),
                DocumentModel(id=39, pages_count=233),
                DocumentModel(id=40, pages_count=831),
            ],
            6: [
                DocumentModel(id=41, pages_count=374),
                DocumentModel(id=42, pages_count=655),
                DocumentModel(id=43, pages_count=186),
                DocumentModel(id=44, pages_count=544),
                DocumentModel(id=45, pages_count=606),
                DocumentModel(id=46, pages_count=351),
                DocumentModel(id=47, pages_count=711),
                DocumentModel(id=48, pages_count=493),
                DocumentModel(id=49, pages_count=292),
                DocumentModel(id=50, pages_count=885),
                DocumentModel(id=51, pages_count=837),
                DocumentModel(id=52, pages_count=486),
                DocumentModel(id=53, pages_count=687),
                DocumentModel(id=54, pages_count=113),
                DocumentModel(id=55, pages_count=167),
                DocumentModel(id=56, pages_count=158),
                DocumentModel(id=57, pages_count=218),
            ],
            7: [
                DocumentModel(id=58, pages_count=400),
                DocumentModel(id=59, pages_count=696),
                DocumentModel(id=60, pages_count=712),
                DocumentModel(id=61, pages_count=789),
                DocumentModel(id=62, pages_count=125),
                DocumentModel(id=63, pages_count=95),
                DocumentModel(id=64, pages_count=833),
                DocumentModel(id=65, pages_count=358),
                DocumentModel(id=66, pages_count=197),
                DocumentModel(id=67, pages_count=315),
                DocumentModel(id=68, pages_count=740),
                DocumentModel(id=69, pages_count=814),
                DocumentModel(id=70, pages_count=423),
                DocumentModel(id=71, pages_count=979),
                DocumentModel(id=72, pages_count=89),
                DocumentModel(id=73, pages_count=881),
                DocumentModel(id=74, pages_count=424),
                DocumentModel(id=75, pages_count=286),
                DocumentModel(id=76, pages_count=848),
                DocumentModel(id=77, pages_count=276),
                DocumentModel(id=78, pages_count=36),
                DocumentModel(id=79, pages_count=483),
                DocumentModel(id=80, pages_count=705),
            ],
            8: [],
            9: [
                DocumentModel(id=81, pages_count=939),
                DocumentModel(id=82, pages_count=540),
                DocumentModel(id=83, pages_count=709),
                DocumentModel(id=84, pages_count=159),
                DocumentModel(id=85, pages_count=372),
                DocumentModel(id=86, pages_count=16),
                DocumentModel(id=87, pages_count=572),
                DocumentModel(id=88, pages_count=551),
                DocumentModel(id=89, pages_count=788),
                DocumentModel(id=90, pages_count=30),
                DocumentModel(id=91, pages_count=756),
                DocumentModel(id=92, pages_count=709),
                DocumentModel(id=93, pages_count=455),
                DocumentModel(id=94, pages_count=462),
                DocumentModel(id=95, pages_count=859),
                DocumentModel(id=96, pages_count=344),
                DocumentModel(id=97, pages_count=209),
                DocumentModel(id=98, pages_count=398),
                DocumentModel(id=99, pages_count=171),
            ],
            10: [],
            11: [],
            12: [
                DocumentModel(
                    id=100,
                    pages_count=500,
                    pages_count_predicted=300,
                ),
            ],
        }.get(id)

        # Act
        generator = ExtractionGenerator(
            40000, GenerateExtraction(target_pages_threshold=0.05), self.db
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        expected_ids = [
            100,
            26,
            27,
            28,
            29,
            30,
            31,
            81,
            82,
            83,
            84,
            85,
            86,
            95,
            97,
            32,
            33,
            34,
            35,
            36,
            37,
            38,
            39,
            40,
            58,
            59,
            60,
            61,
            62,
            63,
            64,
            65,
            66,
            67,
            68,
            69,
            70,
            71,
            72,
            73,
            74,
            75,
            76,
            77,
            78,
            79,
            80,
            41,
            42,
            44,
            45,
            47,
            48,
            49,
            50,
            51,
            52,
            53,
            54,
            56,
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            16,
            19,
            22,
            23,
        ]
        self.assertListEqual(ids, expected_ids)
        self.assertEqual(count, 39241)

    @patch("extractions.generated.preprocessor.get_root_categories")
    @patch("extractions.generated.preprocessor.get_children_categories")
    @patch("extractions.generated.preprocessor.get_extractable_documents")
    def test_extraction_complex_tree_include_category(
        self,
        mock_get_extractable_documents: Mock,
        mock_get_children_categories: Mock,
        mock_get_root_categories: Mock,
    ):
        # Arrange
        odbor_periodik = Category(
            id=1,
            name="Odbor Periodik",
            assignable=False,
            percentage=10,
            parent_id=None,
            level=0,
        )
        morava = Category(
            id=2,
            name="Morava",
            assignable=False,
            percentage=20,
            parent_id=1,
            level=1,
        )
        noviny = Category(
            id=3,
            name="Noviny",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        casopisy = Category(
            id=4,
            name="Casopisy",
            assignable=True,
            percentage=50,
            parent_id=2,
            level=2,
        )
        vyrocni_zpravy = Category(
            id=5,
            name="Vyrocni Zpravy",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        kontinuita = Category(
            id=6,
            name="Kontinuita",
            assignable=True,
            percentage=15,
            parent_id=1,
            level=1,
        )
        dary = Category(
            id=7,
            name="Dary",
            assignable=True,
            percentage=35,
            parent_id=1,
            level=1,
        )
        projekty = Category(
            id=8,
            name="Projekty",
            assignable=False,
            percentage=10,
            parent_id=1,
            level=1,
        )
        alkaro = Category(
            id=9,
            name="Alkaro",
            assignable=True,
            percentage=100,
            parent_id=8,
            level=2,
        )
        test = Category(
            id=10,
            name="Test",
            assignable=False,
            percentage=5,
            parent_id=1,
            level=1,
        )
        category_root2 = Category(
            id=11,
            name="Root 2",
            assignable=False,
            percentage=90,
            parent_id=None,
            level=0,
        )
        category_child21 = Category(
            id=12,
            name="Child 21",
            assignable=True,
            percentage=100,
            parent_id=11,
            level=1,
        )

        mock_get_root_categories.return_value = [
            odbor_periodik,
            category_root2,
        ]

        mock_get_children_categories.side_effect = lambda id, db: {
            1: [morava, vyrocni_zpravy, kontinuita, dary, projekty, test],
            2: [noviny, casopisy],
            3: [],
            4: [],
            5: [],
            6: [],
            7: [],
            8: [alkaro],
            9: [],
            10: [],
            11: [category_child21],
            12: [],
        }.get(id)

        mock_get_extractable_documents.side_effect = lambda id, db: {
            1: [],
            2: [],
            3: [
                DocumentModel(id=1, pages_count=31),
                DocumentModel(id=2, pages_count=464),
                DocumentModel(id=3, pages_count=652),
                DocumentModel(id=4, pages_count=800),
                DocumentModel(id=5, pages_count=30),
                DocumentModel(id=6, pages_count=257),
                DocumentModel(id=7, pages_count=846),
                DocumentModel(id=8, pages_count=137),
                DocumentModel(id=9, pages_count=856),
                DocumentModel(id=10, pages_count=654),
                DocumentModel(id=11, pages_count=731),
                DocumentModel(id=12, pages_count=572),
                DocumentModel(id=13, pages_count=711),
                DocumentModel(id=14, pages_count=832),
                DocumentModel(id=15, pages_count=736),
                DocumentModel(id=16, pages_count=375),
                DocumentModel(id=17, pages_count=426),
                DocumentModel(id=18, pages_count=831),
                DocumentModel(id=19, pages_count=277),
                DocumentModel(id=20, pages_count=374),
                DocumentModel(id=21, pages_count=460),
                DocumentModel(id=22, pages_count=802),
                DocumentModel(id=23, pages_count=94),
                DocumentModel(id=24, pages_count=104),
                DocumentModel(id=25, pages_count=623),
            ],
            4: [
                DocumentModel(id=26, pages_count=768),
                DocumentModel(id=27, pages_count=129),
                DocumentModel(id=28, pages_count=309),
                DocumentModel(id=29, pages_count=689),
                DocumentModel(id=30, pages_count=915),
                DocumentModel(id=31, pages_count=560),
            ],
            5: [
                DocumentModel(id=32, pages_count=596),
                DocumentModel(id=33, pages_count=372),
                DocumentModel(id=34, pages_count=184),
                DocumentModel(id=35, pages_count=409),
                DocumentModel(id=36, pages_count=620),
                DocumentModel(id=37, pages_count=327),
                DocumentModel(id=38, pages_count=530),
                DocumentModel(id=39, pages_count=233),
                DocumentModel(id=40, pages_count=831),
            ],
            6: [
                DocumentModel(id=41, pages_count=374),
                DocumentModel(id=42, pages_count=655),
                DocumentModel(id=43, pages_count=186),
                DocumentModel(id=44, pages_count=544),
                DocumentModel(id=45, pages_count=606),
                DocumentModel(id=46, pages_count=351),
                DocumentModel(id=47, pages_count=711),
                DocumentModel(id=48, pages_count=493),
                DocumentModel(id=49, pages_count=292),
                DocumentModel(id=50, pages_count=885),
                DocumentModel(id=51, pages_count=837),
                DocumentModel(id=52, pages_count=486),
                DocumentModel(id=53, pages_count=687),
                DocumentModel(id=54, pages_count=113),
                DocumentModel(id=55, pages_count=167),
                DocumentModel(id=56, pages_count=158),
                DocumentModel(id=57, pages_count=218),
            ],
            7: [
                DocumentModel(id=58, pages_count=400),
                DocumentModel(id=59, pages_count=696),
                DocumentModel(id=60, pages_count=712),
                DocumentModel(id=61, pages_count=789),
                DocumentModel(id=62, pages_count=125),
                DocumentModel(id=63, pages_count=95),
                DocumentModel(id=64, pages_count=833),
                DocumentModel(id=65, pages_count=358),
                DocumentModel(id=66, pages_count=197),
                DocumentModel(id=67, pages_count=315),
                DocumentModel(id=68, pages_count=740),
                DocumentModel(id=69, pages_count=814),
                DocumentModel(id=70, pages_count=423),
                DocumentModel(id=71, pages_count=979),
                DocumentModel(id=72, pages_count=89),
                DocumentModel(id=73, pages_count=881),
                DocumentModel(id=74, pages_count=424),
                DocumentModel(id=75, pages_count=286),
                DocumentModel(id=76, pages_count=848),
                DocumentModel(id=77, pages_count=276),
                DocumentModel(id=78, pages_count=36),
                DocumentModel(id=79, pages_count=483),
                DocumentModel(id=80, pages_count=705),
            ],
            8: [],
            9: [
                DocumentModel(id=81, pages_count=939),
                DocumentModel(id=82, pages_count=540),
                DocumentModel(id=83, pages_count=709),
                DocumentModel(id=84, pages_count=159),
                DocumentModel(id=85, pages_count=372),
                DocumentModel(id=86, pages_count=16),
                DocumentModel(id=87, pages_count=572),
                DocumentModel(id=88, pages_count=551),
                DocumentModel(id=89, pages_count=788),
                DocumentModel(id=90, pages_count=30),
                DocumentModel(id=91, pages_count=756),
                DocumentModel(id=92, pages_count=709),
                DocumentModel(id=93, pages_count=455),
                DocumentModel(id=94, pages_count=462),
                DocumentModel(id=95, pages_count=859),
                DocumentModel(id=96, pages_count=344),
                DocumentModel(id=97, pages_count=209),
                DocumentModel(id=98, pages_count=398),
                DocumentModel(id=99, pages_count=171),
            ],
            10: [],
            11: [],
            12: [
                DocumentModel(
                    id=100,
                    pages_count=500,
                    pages_count_predicted=300,
                ),
            ],
        }.get(id)

        # Act
        generator = ExtractionGenerator(
            10000,
            GenerateExtraction(
                target_pages_threshold=0.05, include_categories=[7]
            ),
            self.db,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [i for i in range(58, 81)])
        self.assertEqual(count, 11504)
