from unittest import skipIf, TestCase
from unittest.mock import patch, MagicMock
from tests.test_crud import TestCrudOperations
from services.documents_indexer import DocumentsIndexer, INDEX_NAME
from tests.documents_bank import get_test_documents
from tests.helper_funcs import mock_db, get_test_db
from config import VeraConfig
from models import Document
import elasticsearch


def skipIfIndexerUnavailable(test_func):
    """
    Decorator to skip a test if Elasticsearch is not available.
    """
    return skipIf(
        not DocumentsIndexer.is_indexer_available(),
        "Elasticsearch is not available",
    )(test_func)


class TestDocumentsIndexerAvailability(TestCase):
    @patch("elasticsearch.Elasticsearch")
    def test_indexer_available(self, MockElasticsearch):
        # Arrange
        mock_es = MagicMock()
        mock_es.ping.return_value = True
        MockElasticsearch.return_value = mock_es

        # Act and Assert
        self.assertTrue(DocumentsIndexer.is_indexer_available())

    @patch("elasticsearch.Elasticsearch")
    def test_indexer_not_available(self, MockElasticsearch):
        # Arrange
        mock_es = MagicMock()
        mock_es.ping.side_effect = Exception("Connection error")
        MockElasticsearch.return_value = mock_es

        # Act and Assert
        self.assertFalse(DocumentsIndexer.is_indexer_available())


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

    @skipIfIndexerUnavailable
    def test_index_document(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        indexed_document = self.indexer.get(1)

        # Assert
        self.assertEqual(indexed_document["sysno"], document.sysno)
        self.assertEqual(indexed_document["barcode"], document.barcode)
        self.assertEqual(
            indexed_document["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_delete_indexed_document(self):
        # Arrange
        document = Document.get(self.db, 1)

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

    @skipIfIndexerUnavailable
    def test_search(self):
        # Arrange
        document = Document.get(self.db, 1)

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

    @skipIfIndexerUnavailable
    def test_search_by_username(self):
        # Arrange
        document = Document.get(self.db, 1)

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

    @skipIfIndexerUnavailable
    def test_search_all_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {"query": {"match_all": {}}}, "test_user"
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search_all_restricted_for_username_prohibited(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {"query": {"match_all": {}}}, "test_user_2"
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_match_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {"query": {"match": {"barcode": "2610568734"}}},
                    "test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search_match_restricted_for_username_prohibited(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {"query": {"match": {"barcode": "2610568734"}}},
                    "other_test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_must_array_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    "test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search_bool_must_array_restricted_for_username_prohibited(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    "other_test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_must_object_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    "test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search_bool_must_object_restricted_for_username_prohibited(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    "other_test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_should_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    "test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 1)
        self.assertEqual(indexed_documents[0]["sysno"], document.sysno)
        self.assertEqual(indexed_documents[0]["barcode"], document.barcode)
        self.assertEqual(
            indexed_documents[0]["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search_bool_should_object_restricted_for_username_prohibited(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_username(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    "other_test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_match_all_restricted_for_categories_actual_category(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [5]
                )
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

    @skipIfIndexerUnavailable
    def test_search_match_all_restricted_for_categories_parent_category(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [3]
                )
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

    @skipIfIndexerUnavailable
    def test_search_match_all_restricted_for_categories_root_category(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [1]
                )
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

    @skipIfIndexerUnavailable
    def test_search_match_all_restricted_for_categories_other_category(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [4]
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_match_object_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match": {"barcode": document.barcode}}}, [5]
                )
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

    @skipIfIndexerUnavailable
    def test_search_match_object_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {"query": {"match": {"barcode": document.barcode}}}, [4]
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_must_array_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    [5],
                )
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

    @skipIfIndexerUnavailable
    def test_search_bool_must_array_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    [4],
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_must_object_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [5],
                )
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

    @skipIfIndexerUnavailable
    def test_search_bool_must_object_restricted_for_categories_other_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [4],
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_bool_should_restricted_for_categories_actual_category(
        self,
    ):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [5],
                )
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

    @skipIfIndexerUnavailable
    def test_search_bool_should_restricted_for_categories_other_category(self):
        # Arrange
        document = Document.get(self.db, 1)

        # Act
        self.indexer.index(document)
        self.indexer.es.indices.refresh(index=INDEX_NAME)
        indexed_documents = [
            hit["_source"]
            for hit in self.indexer.search(
                DocumentsIndexer.restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [4],
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)
