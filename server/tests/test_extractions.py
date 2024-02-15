import unittest
from helper_funcs import setUpEnv
from unittest.mock import patch


class TestExtractions(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from services.database import get_db

        self.db = next(get_db())

    def test_crud_on_live_db(self):
        from extractions.crud import get_extractions

        for extraction in get_extractions(self.db):
            print(
                extraction.id,
                extraction.extractor,
                extraction.extracted_at,
                extraction.document_ids,
            )

    def test_on_live_db(self):
        from extractions.routines import generate_extraction
        from extractions.schemas import ExtractionCreate

        selected_ids, selected_pages_count = generate_extraction(
            ExtractionCreate(), 15000, self.db
        )
        print(selected_ids)
        print(selected_pages_count)

    def test_extract_one_document(self):
        from extractions.routines import generate_extraction
        from extractions.schemas import DocumentPagesCount, ExtractionCreate
        from categories.models import Category

        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(id=1, name="test", assignable=True, percentage=100)
        ]

        with patch(
            "extractions.crud.get_category_documents"
        ) as mock_get_category_documents:
            mock_get_category_documents.return_value = category_documents
            with patch(
                "categories.crud.get_root_categories"
            ) as mock_get_root_categories:
                mock_get_root_categories.return_value = categories

                selected_ids, selected_pages_count = generate_extraction(
                    ExtractionCreate(), 10, self.db
                )
                self.assertListEqual([1], selected_ids)
                self.assertEqual(10, selected_pages_count)

                selected_ids, selected_pages_count = generate_extraction(
                    ExtractionCreate(), 11, self.db
                )
                self.assertListEqual([1], selected_ids)
                self.assertEqual(10, selected_pages_count)

                selected_ids, selected_pages_count = generate_extraction(
                    ExtractionCreate(), 9, self.db
                )
                self.assertListEqual([], selected_ids)
                self.assertEqual(0, selected_pages_count)

                selected_ids, selected_pages_count = generate_extraction(
                    ExtractionCreate(target_pages_threshold=0.1), 11, self.db
                )
                self.assertListEqual([1], selected_ids)
                self.assertEqual(10, selected_pages_count)

    def test_extract_whole_document(self):
        from extractions.routines import generate_extraction
        from extractions.schemas import DocumentPagesCount, ExtractionCreate
        from categories.models import Category

        category_documents = [
            DocumentPagesCount(id=1, pages_count=10),
        ]
        categories = [
            Category(
                id=1,
                name="test",
                assignable=True,
                percentage=100,
                extract_whole=True,
            )
        ]

        with patch(
            "extractions.crud.get_category_documents"
        ) as mock_get_category_documents:
            mock_get_category_documents.return_value = category_documents
            with patch(
                "categories.crud.get_root_categories"
            ) as mock_get_root_categories:
                mock_get_root_categories.return_value = categories
                with patch(
                    "categories.crud.get_pages_count"
                ) as mock_get_root_categories:
                    mock_get_root_categories.return_value = 10

                    selected_ids, selected_pages_count = generate_extraction(
                        ExtractionCreate(), 10, self.db
                    )
                    self.assertListEqual([1], selected_ids)
                    self.assertEqual(10, selected_pages_count)

                    selected_ids, selected_pages_count = generate_extraction(
                        ExtractionCreate(), 11, self.db
                    )
                    self.assertListEqual([1], selected_ids)
                    self.assertEqual(10, selected_pages_count)

                    selected_ids, selected_pages_count = generate_extraction(
                        ExtractionCreate(), 9, self.db
                    )
                    self.assertListEqual([], selected_ids)
                    self.assertEqual(0, selected_pages_count)

                    # TODO: make this scenario work
                    # selected_ids, selected_pages_count = generate_extraction(
                    #     ExtractionCreate(whole_categories_threshold=0.2),
                    #     9,
                    #     self.db,
                    # )
                    # self.assertListEqual([1], selected_ids)
                    # self.assertEqual(10, selected_pages_count)

                    selected_ids, selected_pages_count = generate_extraction(
                        ExtractionCreate(whole_categories_threshold=0.1),
                        9,
                        self.db,
                    )
                    self.assertListEqual([], selected_ids)
                    self.assertEqual(0, selected_pages_count)
