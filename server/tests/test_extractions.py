from tests.test_base_database import TestBaseDatabase
from typing import List, Tuple, Union

from models import (
    Category,
    Distribution,
    Intention,
    Document,
    CatalogRecord,
    Library,
    Storage,
    Location,
)
from datatypes import LocationState
from schemas import GenerateExtraction
from services.extractions_generator.extraction_node import ExtractionNode
from services.extractions_generator.generator import ExtractionGenerator
from services.extractions_generator.preprocessor import ExtractionPreprocessor
from datetime import date, timedelta
from records_generators import mockDocuments
from exceptions import EmptyExtractionException
from models import Extraction


LEVEL_NAME = ["Root", "Child", "Grandchild", "Great Grandchild"]
TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestExtractionsBase(TestBaseDatabase):
    def mockCategoriesTree(self, tree, assignable=[]):
        def mockCategoriesTreeRec(
            tree, parent_id=None, level=0, parent_prefix=""
        ):
            index = 1
            for category_id, subtree in tree.items():
                self.session.add(
                    Category(
                        id=category_id,
                        name=parent_prefix + str(index),
                        parent_id=parent_id,
                        level=level,
                        assignable=category_id in assignable,
                    )
                )
                self.session.flush()
                mockCategoriesTreeRec(
                    subtree,
                    category_id,
                    level + 1,
                    parent_prefix + str(index) + ".",
                )
                index += 1

        mockCategoriesTreeRec(tree)

    def mockIntention(
        self,
        intention_id=1,
        name="Intention 1",
        target_page_count=12000,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
    ):
        self.session.add(
            Intention(
                id=intention_id,
                name=name,
                target_page_count=target_page_count,
                start_date=start_date,
                end_date=end_date,
            )
        )
        self.session.flush()

    def mockDistribution(
        self,
        intention_id: int,
        per_category_distributions: List[Tuple[int, float]],
    ):
        self.session.add_all(
            [
                Distribution(
                    intention_id=intention_id,
                    category_id=category_id,
                    percentage=percentage,
                )
                for category_id, percentage in per_category_distributions
            ]
        )
        self.session.flush()

    def mockExtractableDocuments(
        self,
        documents: List[
            Union[Tuple[int, int, int], Tuple[int, int, int, int]]
        ],
    ):
        self.session.add_all(
            [
                CatalogRecord(
                    sysno=f"MZK01-001{str(document[0])}",
                    cnb=f"CNB{str(document[0])}",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                )
                for document in documents
            ]
        )
        self.session.flush()
        self.session.add_all(
            [
                Document(
                    id=document[0],
                    sysno=f"MZK01-001{str(document[0])}",
                    pages_count_catalog=document[2],
                    category_id=document[1],
                    extraction_priority=(
                        document[3] if len(document) == 4 else None
                    ),
                )
                for (document) in documents
            ]
        )
        self.session.flush()


class TestExtractionsGeneration(TestExtractionsBase):
    def test_extract_one_document_exact_pages_count(self):
        # Arrange
        self.mockCategoriesTree({1: {}}, [1])
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1, GenerateExtraction(target_pages=10), self.session
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    def test_extract_one_document_higher_pages_count(self):
        # Arrange
        self.mockCategoriesTree({1: {}}, [1])
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1, GenerateExtraction(target_pages=11), self.session
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    def test_extract_one_document_lower_pages_count_outside_threshold(self):
        # Arrange
        self.mockCategoriesTree({1: {}}, [1])
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1, GenerateExtraction(target_pages=9), self.session
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)

    def test_extract_one_document_lower_pages_count_inside_threshold(self):
        # Arrange
        self.mockCategoriesTree({1: {}}, [1])
        self.mockExtractableDocuments([(1, 1, 11)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=10, target_pages_threshold=0.1),
            self.session,
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 11)

    def test_extract_whole_category_exact_pages_count(self):
        # Arrange
        self.session.add(
            Category(
                id=1,
                name="test",
                assignable=True,
                extract_whole=True,
                level=0,
            )
        )
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1, GenerateExtraction(target_pages=10), self.session
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    def test_extract_whole_category_lower_pages_count_inside_threshold(self):
        # Arrange
        self.session.add(
            Category(
                id=1,
                name="test",
                assignable=True,
                extract_whole=True,
                level=0,
            )
        )
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1, GenerateExtraction(target_pages=11), self.session
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    def test_extract_whole_category_higher_pages_count_inside_threshold(self):
        # Arrange
        self.session.add(
            Category(
                id=1,
                name="test",
                assignable=True,
                extract_whole=True,
                level=0,
            )
        )
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=9, whole_categories_threshold=0.2),
            self.session,
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [1])
        self.assertEqual(count, 10)

    def test_extract_whole_category_higher_pages_count_outside_threshold(self):
        # Arrange
        self.session.add(
            Category(
                id=1,
                name="test",
                assignable=True,
                extract_whole=True,
                level=0,
            )
        )
        self.mockExtractableDocuments([(1, 1, 10)])
        self.mockIntention()
        self.mockDistribution(1, [(1, 100)])

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=9, whole_categories_threshold=0.1),
            self.session,
        )
        generator.generate()
        ids = generator.extracted_documents
        count = generator.extracted_pages_count

        # Assert
        self.assertListEqual(ids, [])
        self.assertEqual(count, 0)


class TestExtractionsPreparation(TestExtractionsBase):
    def test_extraction_tree_generator(self):
        self.mockCategoriesTree(
            {1: {3: {6: {}, 7: {}}, 4: {}, 5: {}}, 2: {8: {}, 9: {}}},
            [4, 5, 6, 7, 8],
        )
        self.mockIntention()
        self.mockDistribution(
            1, enumerate([60, 40, 50, 20, 30, 60, 40, 25, 75], 1)
        )
        self.mockExtractableDocuments(
            [
                (4, 4, 181),
                (5, 5, 270),
                (6, 6, 316),
                (7, 7, 446),
                (8, 8, 234),
            ]
        )

        categories_order = [1, 3, 6, 7, 4, 5, 2, 8]
        relative_ratios = [0.6, 0.5, 0.6, 0.4, 0.2, 0.3, 0.4, 1.0]
        overall_target_pages = 1200
        target_pages = [720.0, 360.0, 216.0, 144.0, 144.0, 216.0, 480.0, 480.0]

        # Act
        preprocessor = ExtractionPreprocessor(
            GenerateExtraction(target_pages=overall_target_pages), self.session
        )
        root: ExtractionNode = preprocessor.generate_extraction_tree(1)

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
        self.assertGreater(len(root.children), 0)
        for child in root.children:
            assert_nodes_order_and_target_pages(child)

    def test_extraction(self):
        # Arrange
        self.mockCategoriesTree(
            {1: {}, 2: {}, 3: {}},
            [1, 2, 3],
        )
        self.mockIntention()
        self.mockDistribution(1, enumerate([50, 30, 20], 1))
        self.mockExtractableDocuments(
            [
                (1, 1, 176),
                (2, 1, 203),
                (3, 1, 446),
                (4, 2, 270),
                (5, 2, 27),
                (6, 2, 316),
                (7, 3, 323),
                (8, 3, 234),
                (9, 3, 46),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=1200, target_pages_threshold=0.05),
            self.session,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertEqual(count, 1199)
        self.assertSetEqual(set(ids), set([8, 5, 6, 3, 1]))

    def test_extraction_raise_exception_on_empty_extraction(self):
        # Act and Assert
        with self.assertRaises(EmptyExtractionException):
            Extraction(document_ids=[]).save(self.session)

    def test_extraction_with_priorities(self):
        # Arrange
        self.mockCategoriesTree(
            {1: {}, 2: {}, 3: {}},
            [1, 2, 3],
        )
        self.mockIntention()
        self.mockDistribution(1, enumerate([50, 30, 20], 1))
        self.mockExtractableDocuments(
            [
                (1, 1, 200, 1),
                (2, 1, 200, 2),
                (3, 1, 200, 3),
                (4, 2, 200, 5),
                (5, 2, 200, 4),
                (6, 2, 200, 3),
                (7, 3, 200, 2),
                (8, 3, 200, 1),
                (9, 3, 200, 5),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=1200, target_pages_threshold=0.01),
            self.session,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertEqual(count, 1200)
        self.assertEqual(ids, [3, 2, 1, 4, 9, 5])

    def test_extraction_simple_tree(self):
        # Arrange
        self.mockCategoriesTree(
            {1: {}, 2: {}, 3: {4: {}}},
            [1, 2, 4],
        )
        self.mockIntention()
        self.mockDistribution(1, enumerate([5, 5, 90, 100], 1))
        self.mockExtractableDocuments(
            [
                (1, 1, 176),
                (2, 1, 151),
                (3, 1, 446),
                (4, 2, 270),
                (5, 2, 27),
                (6, 2, 316),
                (7, 4, 500),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(target_pages=1000, target_pages_threshold=0.05),
            self.session,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [7, 5, 1, 4])
        self.assertEqual(count, 973)

    def test_extraction_simple_tree_for_location(self):
        # Arrange
        self.mockCategoriesTree(
            {1: {}, 2: {}, 3: {4: {}}},
            [1, 2, 4],
        )
        self.mockIntention()
        self.mockDistribution(1, enumerate([5, 5, 90, 100], 1))
        mockDocuments(
            self.session,
            {
                "category_id": [1, 1, 1, 2, 2, 2, 4],
                "pages_count_manual": [176, 151, 446, 270, 27, 316, 500],
                "document_signature": [f"2-{i}" for i in range(4)],
                "cnb": [f"CNB{str(i)}" for i in range(1, 8)],
            },
        )
        print([d.signature for d in Document.all(self.session)])
        self.session.add(Library(name="MZK"))
        self.session.flush()
        self.session.add(Storage(library_id=1, name="MZK Storage"))
        self.session.flush()
        self.session.add(
            Location(
                storage_id=1,
                name="Test Location",
                regexp="2",
                state=LocationState.Active,
            )
        )
        self.session.flush()

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=1000,
                target_pages_threshold=0.05,
                location_ids=[1],
            ),
            self.session,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [4, 1, 3])
        self.assertEqual(count, 892)

    def test_extraction_complex_tree(self):
        # Arrange
        self.mockCategoriesTree(
            {
                1: {
                    2: {3: {}, 4: {}},
                    5: {},
                    6: {},
                    7: {},
                    8: {9: {}},
                    10: {},
                    11: {12: {}},
                }
            },
            [3, 4, 5, 6, 7, 9, 12],
        )
        self.mockIntention()
        self.mockDistribution(
            1,
            enumerate([10, 20, 50, 50, 15, 15, 35, 10, 100, 5, 90, 100], 1),
        )
        self.mockExtractableDocuments(
            [
                (1, 3, 31),
                (2, 3, 464),
                (3, 3, 652),
                (4, 3, 800),
                (5, 3, 30),
                (6, 3, 257),
                (7, 3, 846),
                (8, 3, 137),
                (9, 3, 856),
                (10, 3, 654),
                (11, 3, 731),
                (12, 3, 572),
                (13, 3, 711),
                (14, 3, 832),
                (15, 3, 736),
                (16, 3, 375),
                (17, 3, 426),
                (18, 3, 831),
                (19, 3, 277),
                (20, 3, 374),
                (21, 3, 460),
                (22, 3, 802),
                (23, 3, 94),
                (24, 3, 104),
                (25, 3, 623),
                (26, 4, 768),
                (27, 4, 129),
                (28, 4, 309),
                (29, 4, 689),
                (30, 4, 915),
                (31, 4, 560),
                (32, 5, 596),
                (33, 5, 372),
                (34, 5, 184),
                (35, 5, 409),
                (36, 5, 620),
                (37, 5, 327),
                (38, 5, 530),
                (39, 5, 233),
                (40, 5, 831),
                (41, 6, 374),
                (42, 6, 655),
                (43, 6, 186),
                (44, 6, 544),
                (45, 6, 606),
                (46, 6, 351),
                (47, 6, 711),
                (48, 6, 493),
                (49, 6, 292),
                (50, 6, 885),
                (51, 6, 837),
                (52, 6, 486),
                (53, 6, 687),
                (54, 6, 113),
                (55, 6, 167),
                (56, 6, 158),
                (57, 6, 218),
                (58, 7, 400),
                (59, 7, 696),
                (60, 7, 712),
                (61, 7, 789),
                (62, 7, 125),
                (63, 7, 95),
                (64, 7, 833),
                (65, 7, 358),
                (66, 7, 197),
                (67, 7, 315),
                (68, 7, 740),
                (69, 7, 814),
                (70, 7, 423),
                (71, 7, 979),
                (72, 7, 89),
                (73, 7, 881),
                (74, 7, 424),
                (75, 7, 286),
                (76, 7, 848),
                (77, 7, 276),
                (78, 7, 36),
                (79, 7, 483),
                (80, 7, 705),
                (81, 9, 939),
                (82, 9, 540),
                (83, 9, 709),
                (84, 9, 159),
                (85, 9, 372),
                (86, 9, 16),
                (87, 9, 572),
                (88, 9, 551),
                (89, 9, 788),
                (90, 9, 30),
                (91, 9, 756),
                (92, 9, 709),
                (93, 9, 455),
                (94, 9, 462),
                (95, 9, 859),
                (96, 9, 344),
                (97, 9, 209),
                (98, 9, 398),
                (99, 9, 171),
                (100, 12, 500),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=10000, target_pages_threshold=0.05
            ),
            self.session,
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

    def test_extraction_complex_tree_with_dead_path(self):
        # Arrange
        self.mockCategoriesTree(
            {
                1: {
                    2: {3: {}, 4: {}},
                    5: {},
                    6: {},
                    7: {},
                    8: {9: {}},
                    10: {},
                    11: {12: {}},
                }
            },
            [3, 4, 5, 6, 7, 9],
        )
        self.mockIntention()
        self.mockDistribution(
            1,
            enumerate([10, 20, 50, 50, 15, 15, 35, 10, 100, 5, 90, 100], 1),
        )
        self.mockExtractableDocuments(
            [
                (1, 3, 31),
                (2, 3, 464),
                (3, 3, 652),
                (4, 3, 800),
                (5, 3, 30),
                (6, 3, 257),
                (7, 3, 846),
                (8, 3, 137),
                (9, 3, 856),
                (10, 3, 654),
                (11, 3, 731),
                (12, 3, 572),
                (13, 3, 711),
                (14, 3, 832),
                (15, 3, 736),
                (16, 3, 375),
                (17, 3, 426),
                (18, 3, 831),
                (19, 3, 277),
                (20, 3, 374),
                (21, 3, 460),
                (22, 3, 802),
                (23, 3, 94),
                (24, 3, 104),
                (25, 3, 623),
                (26, 4, 768),
                (27, 4, 129),
                (28, 4, 309),
                (29, 4, 689),
                (30, 4, 915),
                (31, 4, 560),
                (32, 5, 596),
                (33, 5, 372),
                (34, 5, 184),
                (35, 5, 409),
                (36, 5, 620),
                (37, 5, 327),
                (38, 5, 530),
                (39, 5, 233),
                (40, 5, 831),
                (41, 6, 374),
                (42, 6, 655),
                (43, 6, 186),
                (44, 6, 544),
                (45, 6, 606),
                (46, 6, 351),
                (47, 6, 711),
                (48, 6, 493),
                (49, 6, 292),
                (50, 6, 885),
                (51, 6, 837),
                (52, 6, 486),
                (53, 6, 687),
                (54, 6, 113),
                (55, 6, 167),
                (56, 6, 158),
                (57, 6, 218),
                (58, 7, 400),
                (59, 7, 696),
                (60, 7, 712),
                (61, 7, 789),
                (62, 7, 125),
                (63, 7, 95),
                (64, 7, 833),
                (65, 7, 358),
                (66, 7, 197),
                (67, 7, 315),
                (68, 7, 740),
                (69, 7, 814),
                (70, 7, 423),
                (71, 7, 979),
                (72, 7, 89),
                (73, 7, 881),
                (74, 7, 424),
                (75, 7, 286),
                (76, 7, 848),
                (77, 7, 276),
                (78, 7, 36),
                (79, 7, 483),
                (80, 7, 705),
                (81, 9, 939),
                (82, 9, 540),
                (83, 9, 709),
                (84, 9, 159),
                (85, 9, 372),
                (86, 9, 16),
                (87, 9, 572),
                (88, 9, 551),
                (89, 9, 788),
                (90, 9, 30),
                (91, 9, 756),
                (92, 9, 709),
                (93, 9, 455),
                (94, 9, 462),
                (95, 9, 859),
                (96, 9, 344),
                (97, 9, 209),
                (98, 9, 398),
                (99, 9, 171),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=10000, target_pages_threshold=0.05
            ),
            self.session,
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
                27,
                30,
                85,
                86,
                93,
                97,
                34,
                37,
                39,
                40,
                58,
                59,
                60,
                61,
                62,
                63,
                65,
                66,
                77,
                78,
                41,
                43,
                53,
                54,
                57,
                6,
                8,
                21,
                23,
                24,
            ],
        )
        self.assertEqual(count, 9985)

    def test_extraction_complex_tree_with_distribution_zero(self):
        # Arrange
        self.mockCategoriesTree(
            {
                1: {
                    2: {3: {}, 4: {}},
                    5: {},
                    6: {},
                    7: {},
                    8: {9: {}},
                    10: {},
                    11: {12: {}},
                }
            },
            [3, 4, 5, 6, 7, 9],
        )
        self.mockIntention()
        self.mockDistribution(
            1,
            enumerate([10, 20, 50, 50, 15, 15, 35, 10, 100, 5, 90, 0], 1),
        )
        self.mockExtractableDocuments(
            [
                (1, 3, 31),
                (2, 3, 464),
                (3, 3, 652),
                (4, 3, 800),
                (5, 3, 30),
                (6, 3, 257),
                (7, 3, 846),
                (8, 3, 137),
                (9, 3, 856),
                (10, 3, 654),
                (11, 3, 731),
                (12, 3, 572),
                (13, 3, 711),
                (14, 3, 832),
                (15, 3, 736),
                (16, 3, 375),
                (17, 3, 426),
                (18, 3, 831),
                (19, 3, 277),
                (20, 3, 374),
                (21, 3, 460),
                (22, 3, 802),
                (23, 3, 94),
                (24, 3, 104),
                (25, 3, 623),
                (26, 4, 768),
                (27, 4, 129),
                (28, 4, 309),
                (29, 4, 689),
                (30, 4, 915),
                (31, 4, 560),
                (32, 5, 596),
                (33, 5, 372),
                (34, 5, 184),
                (35, 5, 409),
                (36, 5, 620),
                (37, 5, 327),
                (38, 5, 530),
                (39, 5, 233),
                (40, 5, 831),
                (41, 6, 374),
                (42, 6, 655),
                (43, 6, 186),
                (44, 6, 544),
                (45, 6, 606),
                (46, 6, 351),
                (47, 6, 711),
                (48, 6, 493),
                (49, 6, 292),
                (50, 6, 885),
                (51, 6, 837),
                (52, 6, 486),
                (53, 6, 687),
                (54, 6, 113),
                (55, 6, 167),
                (56, 6, 158),
                (57, 6, 218),
                (58, 7, 400),
                (59, 7, 696),
                (60, 7, 712),
                (61, 7, 789),
                (62, 7, 125),
                (63, 7, 95),
                (64, 7, 833),
                (65, 7, 358),
                (66, 7, 197),
                (67, 7, 315),
                (68, 7, 740),
                (69, 7, 814),
                (70, 7, 423),
                (71, 7, 979),
                (72, 7, 89),
                (73, 7, 881),
                (74, 7, 424),
                (75, 7, 286),
                (76, 7, 848),
                (77, 7, 276),
                (78, 7, 36),
                (79, 7, 483),
                (80, 7, 705),
                (81, 9, 939),
                (82, 9, 540),
                (83, 9, 709),
                (84, 9, 159),
                (85, 9, 372),
                (86, 9, 16),
                (87, 9, 572),
                (88, 9, 551),
                (89, 9, 788),
                (90, 9, 30),
                (91, 9, 756),
                (92, 9, 709),
                (93, 9, 455),
                (94, 9, 462),
                (95, 9, 859),
                (96, 9, 344),
                (97, 9, 209),
                (98, 9, 398),
                (99, 9, 171),
            ]
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=10000, target_pages_threshold=0.05
            ),
            self.session,
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
                27,
                30,
                85,
                86,
                93,
                97,
                34,
                37,
                39,
                40,
                58,
                59,
                60,
                61,
                62,
                63,
                65,
                66,
                77,
                78,
                41,
                43,
                53,
                54,
                57,
                6,
                8,
                21,
                23,
                24,
            ],
        )
        self.assertEqual(count, 9985)

    def test_extraction_complex_tree_extract_fully(self):
        # Arrange
        self.mockCategoriesTree(
            {
                1: {
                    2: {3: {}, 4: {}},
                    5: {},
                    6: {},
                    7: {},
                    8: {9: {}},
                    10: {},
                    11: {12: {}},
                }
            },
            [3, 4, 5, 6, 7, 9, 12],
        )
        self.mockIntention()
        self.mockDistribution(
            1,
            enumerate([10, 20, 50, 50, 15, 15, 35, 10, 100, 5, 90, 100], 1),
        )
        self.mockExtractableDocuments(
            [
                (1, 3, 31),
                (2, 3, 464),
                (3, 3, 652),
                (4, 3, 800),
                (5, 3, 30),
                (6, 3, 257),
                (7, 3, 846),
                (8, 3, 137),
                (9, 3, 856),
                (10, 3, 654),
                (11, 3, 731),
                (12, 3, 572),
                (13, 3, 711),
                (14, 3, 832),
                (15, 3, 736),
                (16, 3, 375),
                (17, 3, 426),
                (18, 3, 831),
                (19, 3, 277),
                (20, 3, 374),
                (21, 3, 460),
                (22, 3, 802),
                (23, 3, 94),
                (24, 3, 104),
                (25, 3, 623),
                (26, 4, 768),
                (27, 4, 129),
                (28, 4, 309),
                (29, 4, 689),
                (30, 4, 915),
                (31, 4, 560),
                (32, 5, 596),
                (33, 5, 372),
                (34, 5, 184),
                (35, 5, 409),
                (36, 5, 620),
                (37, 5, 327),
                (38, 5, 530),
                (39, 5, 233),
                (40, 5, 831),
                (41, 6, 374),
                (42, 6, 655),
                (43, 6, 186),
                (44, 6, 544),
                (45, 6, 606),
                (46, 6, 351),
                (47, 6, 711),
                (48, 6, 493),
                (49, 6, 292),
                (50, 6, 885),
                (51, 6, 837),
                (52, 6, 486),
                (53, 6, 687),
                (54, 6, 113),
                (55, 6, 167),
                (56, 6, 158),
                (57, 6, 218),
                (58, 7, 400),
                (59, 7, 696),
                (60, 7, 712),
                (61, 7, 789),
                (62, 7, 125),
                (63, 7, 95),
                (64, 7, 833),
                (65, 7, 358),
                (66, 7, 197),
                (67, 7, 315),
                (68, 7, 740),
                (69, 7, 814),
                (70, 7, 423),
                (71, 7, 979),
                (72, 7, 89),
                (73, 7, 881),
                (74, 7, 424),
                (75, 7, 286),
                (76, 7, 848),
                (77, 7, 276),
                (78, 7, 36),
                (79, 7, 483),
                (80, 7, 705),
                (81, 9, 939),
                (82, 9, 540),
                (83, 9, 709),
                (84, 9, 159),
                (85, 9, 372),
                (86, 9, 16),
                (87, 9, 572),
                (88, 9, 551),
                (89, 9, 788),
                (90, 9, 30),
                (91, 9, 756),
                (92, 9, 709),
                (93, 9, 455),
                (94, 9, 462),
                (95, 9, 859),
                (96, 9, 344),
                (97, 9, 209),
                (98, 9, 398),
                (99, 9, 171),
            ]
        )
        self.session.add(
            CatalogRecord(
                sysno="MZK01-001100",
                cnb="CCNB100",
                marc=TEST_MARC_BYTES,
            )
        )
        self.session.flush()
        self.session.add(
            Document(
                id=100,
                sysno="MZK01-001100",
                pages_count_catalog=500,
                pages_count_predicted=300,
            )
        )
        self.session.flush()

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=40000, target_pages_threshold=0.05
            ),
            self.session,
        )
        generator.generate()
        _, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        # expected_ids = set(
        #     [
        #         100,
        #         26,
        #         27,
        #         28,
        #         29,
        #         30,
        #         31,
        #         81,
        #         82,
        #         83,
        #         84,
        #         85,
        #         86,
        #         95,
        #         97,
        #         32,
        #         33,
        #         34,
        #         35,
        #         36,
        #         37,
        #         38,
        #         39,
        #         40,
        #         58,
        #         59,
        #         60,
        #         61,
        #         62,
        #         63,
        #         64,
        #         65,
        #         66,
        #         67,
        #         68,
        #         69,
        #         70,
        #         71,
        #         72,
        #         73,
        #         74,
        #         75,
        #         76,
        #         77,
        #         78,
        #         79,
        #         80,
        #         41,
        #         42,
        #         44,
        #         45,
        #         47,
        #         48,
        #         49,
        #         50,
        #         51,
        #         52,
        #         53,
        #         54,
        #         56,
        #         1,
        #         2,
        #         3,
        #         4,
        #         5,
        #         6,
        #         7,
        #         8,
        #         9,
        #         10,
        #         11,
        #         12,
        #         13,
        #         14,
        #         16,
        #         19,
        #         22,
        #         23,
        #     ]
        # )
        self.assertEqual(count, 39182)
        # self.assertSetEqual(set(ids), expected_ids)

    def test_extraction_complex_tree_include_category(self):
        # Arrange
        self.mockCategoriesTree(
            {
                1: {
                    2: {3: {}, 4: {}},
                    5: {},
                    6: {},
                    7: {},
                    8: {9: {}},
                    10: {},
                    11: {12: {}},
                }
            },
            [3, 4, 5, 6, 7, 9, 12],
        )
        self.mockIntention()
        self.mockDistribution(
            1,
            enumerate([10, 20, 50, 50, 15, 15, 35, 10, 100, 5, 90, 100], 1),
        )
        self.mockExtractableDocuments(
            [
                (1, 3, 31),
                (2, 3, 464),
                (3, 3, 652),
                (4, 3, 800),
                (5, 3, 30),
                (6, 3, 257),
                (7, 3, 846),
                (8, 3, 137),
                (9, 3, 856),
                (10, 3, 654),
                (11, 3, 731),
                (12, 3, 572),
                (13, 3, 711),
                (14, 3, 832),
                (15, 3, 736),
                (16, 3, 375),
                (17, 3, 426),
                (18, 3, 831),
                (19, 3, 277),
                (20, 3, 374),
                (21, 3, 460),
                (22, 3, 802),
                (23, 3, 94),
                (24, 3, 104),
                (25, 3, 623),
                (26, 4, 768),
                (27, 4, 129),
                (28, 4, 309),
                (29, 4, 689),
                (30, 4, 915),
                (31, 4, 560),
                (32, 5, 596),
                (33, 5, 372),
                (34, 5, 184),
                (35, 5, 409),
                (36, 5, 620),
                (37, 5, 327),
                (38, 5, 530),
                (39, 5, 233),
                (40, 5, 831),
                (41, 6, 374),
                (42, 6, 655),
                (43, 6, 186),
                (44, 6, 544),
                (45, 6, 606),
                (46, 6, 351),
                (47, 6, 711),
                (48, 6, 493),
                (49, 6, 292),
                (50, 6, 885),
                (51, 6, 837),
                (52, 6, 486),
                (53, 6, 687),
                (54, 6, 113),
                (55, 6, 167),
                (56, 6, 158),
                (57, 6, 218),
                (58, 7, 400),
                (59, 7, 696),
                (60, 7, 712),
                (61, 7, 789),
                (62, 7, 125),
                (63, 7, 95),
                (64, 7, 833),
                (65, 7, 358),
                (66, 7, 197),
                (67, 7, 315),
                (68, 7, 740),
                (69, 7, 814),
                (70, 7, 423),
                (71, 7, 979),
                (72, 7, 89),
                (73, 7, 881),
                (74, 7, 424),
                (75, 7, 286),
                (76, 7, 848),
                (77, 7, 276),
                (78, 7, 36),
                (79, 7, 483),
                (80, 7, 705),
                (81, 9, 939),
                (82, 9, 540),
                (83, 9, 709),
                (84, 9, 159),
                (85, 9, 372),
                (86, 9, 16),
                (87, 9, 572),
                (88, 9, 551),
                (89, 9, 788),
                (90, 9, 30),
                (91, 9, 756),
                (92, 9, 709),
                (93, 9, 455),
                (94, 9, 462),
                (95, 9, 859),
                (96, 9, 344),
                (97, 9, 209),
                (98, 9, 398),
                (99, 9, 171),
            ]
        )
        self.session.add(
            CatalogRecord(
                sysno="MZK01-001100",
                cnb="CCNB100",
                marc=TEST_MARC_BYTES,
            )
        )
        self.session.add(
            Document(
                id=100,
                sysno="MZK01-001100",
                pages_count_catalog=500,
                pages_count_predicted=300,
            )
        )

        # Act
        generator = ExtractionGenerator(
            1,
            GenerateExtraction(
                target_pages=20000,
                target_pages_threshold=0.05,
                include_categories=[7],
            ),
            self.session,
        )
        generator.generate()
        ids, count = (
            generator.extracted_documents,
            generator.extracted_pages_count,
        )

        # Assert
        self.assertListEqual(ids, [i for i in range(58, 81)])
        self.assertEqual(count, 11504)
