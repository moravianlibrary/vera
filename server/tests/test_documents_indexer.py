from unittest import skipIf
from tests.test_crud import TestCrudOperations
from services.documents_indexer import DocumentsIndexer, INDEX_NAME
from tests.documents_bank import get_test_documents
from tests.helper_funcs import mock_db, get_test_db
from crud.documents import get_document
from config import VeraConfig
import elasticsearch


def is_indexer_available() -> bool:
    try:
        return elasticsearch.Elasticsearch(
            VeraConfig.ElasticsearchUrl,
            http_auth=(
                VeraConfig.ElasticsearchUsername,
                VeraConfig.ElasticsearchPassword,
            ),
        ).ping()
    except Exception:
        return False


class TestDocumentsIndexer(TestCrudOperations):
    def setUp(self):
        self.indexer = DocumentsIndexer(
            VeraConfig.ElasticsearchUrl,
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
        )
        self.indexer.recreate_index()
        mock_db(get_test_documents())
        self.db = get_test_db()

    def tearDown(self) -> None:
        self.indexer.close()
        return self.db.close()

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_index_document(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        indexed_document = self.indexer.get(1)

        # Assert
        self.assertEqual(indexed_document["sysno"], document.sysno)
        self.assertEqual(indexed_document["barcode"], document.barcode)
        self.assertEqual(
            indexed_document["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_delete_indexed_document(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        indexed_document = self.indexer.get(1)
        self.indexer.delete(1)

        # Assert
        self.assertRaises(elasticsearch.NotFoundError, self.indexer.get, 1)
        self.assertEqual(indexed_document["sysno"], document.sysno)
        self.assertEqual(indexed_document["barcode"], document.barcode)
        self.assertEqual(
            indexed_document["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search({"query": {"match_all": {}}})[
                "hits"
            ]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_by_username(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                {
                    "query": {
                        "bool": {"must": {"term": {"added_by": "test_user"}}},
                    }
                }
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_all_restricted_for_username_permitted(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user", {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_all_restricted_for_username_prohibited(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user_2", {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_restricted_for_username_permitted(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user", {"query": {"match": {"barcode": "2610568734"}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_restricted_for_username_prohibited(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "other_test_user",
                {"query": {"match": {"barcode": "2610568734"}}},
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_array_restricted_for_username_permitted(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user",
                {
                    "query": {
                        "bool": {"must": [{"term": {"barcode": "2610568734"}}]}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_array_restricted_for_username_prohibited(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "other_test_user",
                {
                    "query": {
                        "bool": {"must": [{"term": {"barcode": "2610568734"}}]}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_object_restricted_for_username_permitted(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user",
                {
                    "query": {
                        "bool": {"must": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_object_restricted_for_username_prohibited(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "other_test_user",
                {
                    "query": {
                        "bool": {"must": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_should_restricted_for_username_permitted(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "test_user",
                {
                    "query": {
                        "bool": {"should": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_should_object_restricted_for_username_prohibited(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_restricted_for_username(
                "other_test_user",
                {
                    "query": {
                        "bool": {"should": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_all_restricted_for_categories_actual_category(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [5], {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_all_restricted_for_categories_parent_category(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [3], {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_all_restricted_for_categories_root_category(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [1], {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_all_restricted_for_categories_other_category(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [4], {"query": {"match_all": {}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_object_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [5], {"query": {"match": {"barcode": document.barcode}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_match_object_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [4], {"query": {"match": {"barcode": document.barcode}}}
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_array_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [5],
                {
                    "query": {
                        "bool": {"must": [{"term": {"barcode": "2610568734"}}]}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_array_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [4],
                {
                    "query": {
                        "bool": {"must": [{"term": {"barcode": "2610568734"}}]}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_object_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [5],
                {
                    "query": {
                        "bool": {"must": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_must_object_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [4],
                {
                    "query": {
                        "bool": {"must": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_should_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [5],
                {
                    "query": {
                        "bool": {"should": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIf(not is_indexer_available(), "Elasticsearch is not available")
    def test_search_bool_should_restricted_for_categories_other_category(self):
        # Arrange
        document = get_document(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search_for_categories(
                [4],
                {
                    "query": {
                        "bool": {"should": {"term": {"barcode": "2610568734"}}}
                    }
                },
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)
