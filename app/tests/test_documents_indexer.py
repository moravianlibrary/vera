from unittest import skipIf

import elasticsearch
import requests
from requests.exceptions import RequestException

from adapters.elasticsearch import get_es_session
from config import VeraConfig
from models import Document
from routers.utils.query_restrictions import (
    restrict_query_params_for_categories,
    restrict_query_params_for_username,
)
from schemas import IndexDocument
from tests.documents_bank import get_test_documents
from tests.test_base_database import TestBaseDatabase

INDEX_NAME = "documents"


def is_indexer_available() -> bool:
    try:
        response = requests.get(VeraConfig.ElasticsearchUrl)
        if response.status_code not in [200, 401]:
            return False
    except RequestException:
        return False
    try:
        return elasticsearch.Elasticsearch(
            VeraConfig.ElasticsearchUrl,
            basic_auth=(
                VeraConfig.ElasticsearchUsername,
                VeraConfig.ElasticsearchPassword,
            ),
        ).ping()
    except Exception:
        return False


def skipIfIndexerUnavailable(test_func):
    """
    Decorator to skip a test if Elasticsearch is not available.
    """
    return skipIf(
        # not is_indexer_available(),
        True,
        "Elasticsearch is not available",
    )(test_func)


# TODO: fix
# class TestDocumentsIndexerAvailability(TestCase):
#     @patch("requests.get")
#     @patch("elasticsearch.Elasticsearch")
#     def test_indexer_available(self, MockElasticsearch, MockRequestsGet):
#         # Arrange
#         # Mock requests.get to return a response with status code 200
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         MockRequestsGet.return_value = mock_response

#         # Mock Elasticsearch ping to return True
#         mock_es = MagicMock()
#         mock_es.ping.return_value = True
#         MockElasticsearch.return_value = mock_es

#         # Act and Assert
#         self.assertTrue(DocumentsIndexer.is_indexer_available())

#     @patch("requests.get")
#     @patch("elasticsearch.Elasticsearch")
#     def test_indexer_not_available_due_to_requests_failure(
#         self, MockElasticsearch, MockRequestsGet
#     ):
#         # Arrange
#         # Mock requests.get to raise a RequestException
#         MockRequestsGet.side_effect = RequestException()

#         # Act and Assert
#         self.assertFalse(DocumentsIndexer.is_indexer_available())

#     @patch("requests.get")
#     @patch("elasticsearch.Elasticsearch")
#     def test_indexer_not_available_due_to_non_200_status_code(
#         self, MockElasticsearch, MockRequestsGet
#     ):
#         # Arrange
#         # Mock requests.get to return a response with status code 500
#         mock_response = MagicMock()
#         mock_response.status_code = 500
#         MockRequestsGet.return_value = mock_response

#         # Act and Assert
#         self.assertFalse(DocumentsIndexer.is_indexer_available())

#     @patch("requests.get")
#     @patch("elasticsearch.Elasticsearch")
#     def test_indexer_not_available_due_to_elasticsearch_ping_failure(
#         self, MockElasticsearch, MockRequestsGet
#     ):
#         # Arrange
#         # Mock requests.get to return a response with status code 200
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         MockRequestsGet.return_value = mock_response

#         # Mock Elasticsearch ping to raise an exception
#         mock_es = MagicMock()
#         mock_es.ping.side_effect = Exception("Ping failure")
#         MockElasticsearch.return_value = mock_es

#         # Act and Assert
#         self.assertFalse(DocumentsIndexer.is_indexer_available())

#     @patch("requests.get")
#     @patch("elasticsearch.Elasticsearch")
#     def test_indexer_not_available_due_to_ping_returning_false(
#         self, MockElasticsearch, MockRequestsGet
#     ):
#         # Arrange
#         # Mock requests.get to return a response with status code 200
#         mock_response = MagicMock()
#         mock_response.status_code = 200
#         MockRequestsGet.return_value = mock_response

#         # Mock Elasticsearch ping to return False
#         mock_es = MagicMock()
#         mock_es.ping.return_value = False
#         MockElasticsearch.return_value = mock_es

#         # Act and Assert
#         self.assertFalse(DocumentsIndexer.is_indexer_available())


class TestDocumentsIndexer(TestBaseDatabase):
    def setUp(self):
        super().setUp()

        self.es_session = next(get_es_session())
        IndexDocument.recreate_index(self.es_session)

        for item in get_test_documents():
            self.session.add(item)
            self.session.flush()

    def tearDown(self) -> None:
        IndexDocument.close()
        super().tearDown()

    @skipIfIndexerUnavailable
    def test_index_document(self):
        # Arrange
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        indexed_document = IndexDocument.get(self.es_session, 1)

        # Assert
        self.assertEqual(indexed_document["sysno"], document.sysno)
        self.assertEqual(indexed_document["barcode"], document.barcode)
        self.assertEqual(
            indexed_document["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_delete_indexed_document(self):
        # Arrange
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        indexed_document = IndexDocument.get(1)
        IndexDocument.delete(1)

        # Assert
        self.assertRaises(elasticsearch.NotFoundError, IndexDocument.get, 1)
        self.assertEqual(indexed_document["sysno"], document.sysno)
        self.assertEqual(indexed_document["barcode"], document.barcode)
        self.assertEqual(
            indexed_document["category_path"], document.category_path
        )

    @skipIfIndexerUnavailable
    def test_search(self):
        # Arrange
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search({"query": {"match_all": {}}})[
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
                    {"query": {"match_all": {}}}, "test_user_2"
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(len(indexed_documents), 0)

    @skipIfIndexerUnavailable
    def test_search_match_restricted_for_username_permitted(self):
        # Arrange
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_username(
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [5], "other_test_user"
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [3], "other_test_user"
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [1], "other_test_user"
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match_all": {}}}, [4], "other_test_user"
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match": {"barcode": document.barcode}}},
                    [5],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {"query": {"match": {"barcode": document.barcode}}},
                    [4],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    [5],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": [{"term": {"barcode": "2610568734"}}]
                            }
                        }
                    },
                    [4],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [5],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "must": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [4],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [5],
                    "other_test_user",
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
        document = Document.get(self.session, 1)

        # Act
        IndexDocument(document).save(self.es_session)
        IndexDocument.refresh_index(self.es_session)
        indexed_documents = [
            hit["_source"]
            for hit in IndexDocument.search(
                restrict_query_params_for_categories(
                    {
                        "query": {
                            "bool": {
                                "should": {"term": {"barcode": "2610568734"}}
                            }
                        }
                    },
                    [4],
                    "other_test_user",
                )
            )["hits"]["hits"]
        ]

        # Assert
        self.assertEqual(document.category_id, 5)
        self.assertEqual(len(indexed_documents), 0)


# TODO: reimplement
# class TestDocumentsSearch(TestCase):
#     @classmethod
#     def setUpClass(cls):
#         mockClsEnv(cls)

#         mock_db(get_test_documents())
#         cls.db = get_test_db()

#         cls.indexer = DocumentsIndexer(
#             VeraConfig.ElasticsearchUrl,
#             VeraConfig.ElasticsearchUsername,
#             VeraConfig.ElasticsearchPassword,
#         )
#         cls.indexer.recreate_index()
#         cls.indexer.refresh_index(self.es_session)

#         for document in range(1, 47):
#             cls.indexer.index(Document.get(cls.db, document))

#         cls.indexer.refresh_index(self.es_session)

#         cls.client = createTestClient()

#     @classmethod
#     def tearDownClass(cls):
#         cls.patcher.stop()
#         cleanUpDependencyOverrides()
#         cls.indexer.close()
#         meta = test_crud.MetaData()
#         meta.reflect(bind=test_crud.test_engine)
#         meta.drop_all(bind=test_crud.test_engine)
#         cls.db.close()

#     def setUp(self):
#         self.session = TestDocumentsSearch.db
#         IndexDocument = TestDocumentsSearch.indexer

#     def test_sort_by_barcode(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": {"term": {"added_by": "test_user"}}},
#             },
#             "sort": [{"barcode": {"order": "asc", "missing": "_first"}}],
#             "size": 5,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertIsNone(documents[0]["barcode"])
#         self.assertIsNone(documents[1]["barcode"])
#         self.assertEqual(documents[2]["barcode"], "2610051177")
#         self.assertEqual(documents[3]["barcode"], "2610051177")
#         self.assertEqual(documents[4]["barcode"], "2610140568")

#     def test_sort_by_barcode_desc(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": {"term": {"added_by": "test_user"}}},
#             },
#             "sort": [{"barcode": {"order": "desc"}}],
#             "size": 5,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(documents[0]["barcode"], "BC-2489007")
#         self.assertEqual(documents[1]["barcode"], "BC-2489006")
#         self.assertEqual(documents[2]["barcode"], "BC-2489005")
#         self.assertEqual(documents[3]["barcode"], "BC-2489004")
#         self.assertEqual(documents[4]["barcode"], "BC-2282174")

#     def test_search_by_phrase(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "should": [
#                         {"wildcard": {"sysno": "26100*"}},
#                         {"wildcard": {"barcode": "26100*"}},
#                         {"wildcard": {"isxn": "26100*"}},
#                         {"wildcard": {"category_name": "26100*"}},
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 2)
#         self.assertEqual(documents[0]["barcode"], "2610051177")
#         self.assertEqual(documents[1]["barcode"], "2610051177")

#     def test_search_by_id_list(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": {"terms": {"id": [23, 24, 25]}}},
#             },
#             "sort": [{"barcode": {"order": "desc"}}],
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 3)
#         self.assertEqual(documents[0]["id"], 23)
#         self.assertEqual(documents[1]["id"], 25)
#         self.assertEqual(documents[2]["id"], 24)

#     def test_search_by_title_starts_with(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {"wildcard": {"title": {"value": "Zakázanou*"}}},
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 2)
#         self.assertEqual(documents[0]["id"], 4)
#         self.assertEqual(documents[1]["id"], 5)

#     def test_search_by_title_equals(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {"term": {"publishing_place": "Praha :"}},
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 16)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [1, 4, 5, 6, 7, 8, 13, 15, 22, 23, 24, 29, 30, 31, 32, 45],
#         )

#     def test_search_by_publisher_ends_with(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {"wildcard": {"publisher": {"value": "*jednota"}}}
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [23, 29, 30, 31, 32],
#         )

#     def test_search_by_signature_contains(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [{"wildcard": {"signature": {"value": "*1003*"}}}]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 1)
#         self.assertEqual(documents[0]["id"], 45)

#     def test_search_by_sysno_not_contains(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must_not": [{"wildcard": {"sysno": {"value": "*01-*"}}}]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 2)
#         self.assertEqual(documents[0]["id"], 26)
#         self.assertEqual(documents[1]["id"], 27)

#     def test_search_by_creator_not_equals(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must_not": [{"term": {"added_by": "test_user"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 1)
#         self.assertEqual(documents[0]["id"], 21)

#     def test_search_by_barcode_is_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must_not": [{"exists": {"field": "barcode"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 2)
#         self.assertEqual(documents[0]["id"], 26)
#         self.assertEqual(documents[1]["id"], 27)

#     def test_search_by_bundle_is_not_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {"bool": {"must": [{"exists": {"field": "bundle"}}]}},
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 11)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [23, 29, 30, 31, 32, 38, 39, 40, 41, 42, 45],
#         )

#     def test_search_by_page_count_equal_to(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": [{"term": {"page_count": {"value": 480}}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 1)
#         self.assertEqual(documents[0]["id"], 15)

#     def test_search_by_page_count_manual_not_equal_to(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must_not": [{"term": {"page_count_manual": 1}}],
#                     "must": {"exists": {"field": "page_count_manual"}},
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(
#             [document["id"] for document in documents], [6, 22, 40, 41, 42]
#         )

#     def test_search_by_page_count_predicted_less_than(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [{"range": {"page_count_predicted": {"lte": 100}}}]
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 7)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [38, 39, 40, 41, 42, 45, 46],
#         )

#     def test_search_by_page_count_predicted_between(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {
#                             "range": {
#                                 "page_count_predicted": {
#                                     "gte": 100,
#                                     "lte": 200,
#                                 }
#                             }
#                         }
#                     ]
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(
#             [document["id"] for document in documents], [33, 34, 35, 36, 37]
#         )

#     def test_search_by_page_count_catalog_more_than(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [{"range": {"page_count_predicted": {"gte": 300}}}]
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(
#             [document["id"] for document in documents], [23, 29, 30, 31, 32]
#         )

#     def test_search_by_page_count_is_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must_not": [{"exists": {"field": "page_count"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 3)
#         self.assertEqual(
#             [document["id"] for document in documents], [16, 17, 18]
#         )

#     def test_search_by_page_count_manual_is_not_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": [{"exists": {"field": "page_count_manual"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 7)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [6, 22, 26, 27, 40, 41, 42],
#         )

#     def test_search_by_category_is_in(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {
#                             "nested": {
#                                 "path": "category_path",
#                                 "query": {
#                                     "terms": {"category_path.category_id": [2]}
#                                 },
#                             }
#                         },
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 5)
#         self.assertEqual(
#             [document["id"] for document in documents], [28, 29, 30, 31, 32]
#         )

#     def test_search_by_category_is_not_in(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must_not": [
#                         {
#                             "nested": {
#                                 "path": "category_path",
#                                 "query": {
#                                     "terms": {"category_path.category_id": [2]}
#                                 },
#                             }
#                         },
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 41)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             list(range(1, 28)) + list(range(33, 47)),
#         )

#     def test_search_by_category_is_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must_not": [{"exists": {"field": "category_id"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 28)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             list(range(14, 28)) + list(range(33, 47)),
#         )

#     def test_search_by_category_is_not_null(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {"must": [{"exists": {"field": "category_id"}}]}
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 18)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             list(range(1, 14)) + list(range(28, 33)),
#         )

#     def test_search_by_digitization_state_in_progress(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {
#                             "term": {
#                                 "digitization_state": {"value": "InProgress"}
#                             }
#                         }
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 2)
#         self.assertEqual(documents[0]["id"], 4)
#         self.assertEqual(documents[1]["id"], 5)

#     def test_search_by_issuance_type_not_a_unit(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must_not": [
#                         {"term": {"issuance_type": {"value": "Unit"}}}
#                     ]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 26)
#         for document in documents:
#             self.assertNotEqual(document["issuance_type"], "Unit")

#     def test_search_by_location_match(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [{"regexp": {"signature": {"value": "2-.*"}}}]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 33)
#         for document in documents:
#             self.assertRegex(document["signature"], "^2-.*")

#     def test_search_by_location_not_match(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must_not": [{"regexp": {"signature": {"value": "2-.*"}}}]
#                 }
#             },
#             "size": 50,
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 13)
#         for document in documents:
#             self.assertNotRegex(document["signature"], "^2-.*")

#     def test_search_match_all(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {"term": {"issuance_type": "Unit"}},
#                         {"wildcard": {"publishing_place": "*Praha*"}},
#                         {"range": {"page_count_catalog": {"gt": 200}}},
#                         {
#                             "nested": {
#                                 "path": "category_path",
#                                 "query": {
#                                     "terms": {"category_path.category_id": [4]}
#                                 },
#                             }
#                         },
#                         {"term": {"publishing_year": "1969"}},
#                     ]
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 1)
#         self.assertEqual(documents[0]["id"], 8)

#     def test_search_match_any(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "should": [
#                         {"term": {"cnb": "cnb000424990"}},
#                         {"term": {"sysno": "MZK01-001371756"}},
#                         {"term": {"title": "Vlaky celého světa /"}},
#                     ],
#                     "minimum_should_match": 1,
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 3)
#         self.assertEqual(documents[0]["id"], 11)
#         self.assertEqual(documents[1]["id"], 15)
#         self.assertEqual(documents[2]["id"], 8)

#     def test_search_by_username(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableAll])
#         mockUser(test_user)

#         query = {
#             "query": {
#                 "bool": {
#                     "must": [
#                         {"term": {"added_by": "vera_admin"}},
#                     ],
#                 }
#             }
#         }

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 1)
#         self.assertEqual(documents[0]["id"], 21)

#     def test_search_restricted_by_department(self):
#         from models import Department, CategoryDepartments

#         # Arange
#         session = get_test_db()
#         Department(abbreviation="IT", name="IT").save(session).save_users(
#             session, ["test_user"]
#         )
#         CategoryDepartments(category_id=1, department_id=1).save(session)
#         test_user = createTestUser([ActionType.ReadDatatableDepartment], 1)
#         test_user.department_categories_ids = [1]
#         mockUser(test_user)

#         query = {"query": {"match_all": {}}}

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 10)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [i for i in range(1, 11)],
#         )
#         session.close()

#     def test_search_restricted_by_user(self):
#         # Arange
#         test_user = createTestUser([ActionType.ReadDatatableOwn])
#         mockUser(test_user)

#         query = {"query": {"match_all": {}}}

#         # Act
#         response = self.client.post(
#             "/documents/query",
#             headers={"Authorization": "Bearer test_token"},
#             json=query,
#         )

#         # Assert
#         self.assertEqual(response.status_code, 200)

#         documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

#         self.assertEqual(len(documents), 10)
#         self.assertEqual(
#             [document["id"] for document in documents],
#             [i for i in range(1, 11)],
#         )
