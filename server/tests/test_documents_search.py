import unittest
from tests.helper_funcs import (
    createTestUser,
    mockUser,
    mock_db,
    get_test_db,
    mockClsEnv,
    cleanUpDependencyOverrides,
    createTestClient,
)
from tests.documents_bank import get_test_documents
from models import Document
from datatypes import ActionType
from services.documents_indexer import DocumentsIndexer, INDEX_NAME
from config import VeraConfig
from tests import test_crud


class TestDocumentsSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

        mock_db(get_test_documents())
        cls.db = get_test_db()

        cls.indexer = DocumentsIndexer(
            VeraConfig.ElasticsearchUrl,
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
        )
        cls.indexer.recreate_index()
        cls.indexer.es.indices.refresh(index=INDEX_NAME)

        for document in range(1, 47):
            cls.indexer.index(Document.get(cls.db, document))

        cls.indexer.es.indices.refresh(index=INDEX_NAME)

        cls.client = createTestClient()

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()
        cleanUpDependencyOverrides()
        cls.indexer.close()
        meta = test_crud.MetaData()
        meta.reflect(bind=test_crud.test_engine)
        meta.drop_all(bind=test_crud.test_engine)
        cls.db.close()

    def setUp(self):
        self.db = TestDocumentsSearch.db
        self.indexer = TestDocumentsSearch.indexer

    def test_sort_by_barcode(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": {"term": {"added_by": "test_user"}}},
            },
            "sort": [{"barcode": {"order": "asc", "missing": "_first"}}],
            "size": 5,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertIsNone(documents[0]["barcode"])
        self.assertIsNone(documents[1]["barcode"])
        self.assertEqual(documents[2]["barcode"], "2610051177")
        self.assertEqual(documents[3]["barcode"], "2610051177")
        self.assertEqual(documents[4]["barcode"], "2610140568")

    def test_sort_by_barcode_desc(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": {"term": {"added_by": "test_user"}}},
            },
            "sort": [{"barcode": {"order": "desc"}}],
            "size": 5,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(documents[0]["barcode"], "BC-2489007")
        self.assertEqual(documents[1]["barcode"], "BC-2489006")
        self.assertEqual(documents[2]["barcode"], "BC-2489005")
        self.assertEqual(documents[3]["barcode"], "BC-2489004")
        self.assertEqual(documents[4]["barcode"], "BC-2282174")

    def test_search_by_phrase(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "should": [
                        {"wildcard": {"sysno": "26100*"}},
                        {"wildcard": {"barcode": "26100*"}},
                        {"wildcard": {"isxn": "26100*"}},
                        {"wildcard": {"category_name": "26100*"}},
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["barcode"], "2610051177")
        self.assertEqual(documents[1]["barcode"], "2610051177")

    def test_search_by_id_list(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [23, 24, 25]}}},
            },
            "sort": [{"barcode": {"order": "desc"}}],
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 3)
        self.assertEqual(documents[0]["id"], 23)
        self.assertEqual(documents[1]["id"], 25)
        self.assertEqual(documents[2]["id"], 24)

    def test_search_by_title_starts_with(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {"wildcard": {"title": {"value": "Zakázanou*"}}},
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 4)
        self.assertEqual(documents[1]["id"], 5)

    def test_search_by_title_equals(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"publishing_place": "Praha :"}},
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 16)
        self.assertEqual(
            [document["id"] for document in documents],
            [1, 4, 5, 6, 7, 8, 13, 15, 22, 23, 24, 29, 30, 31, 32, 45],
        )

    def test_search_by_publisher_ends_with(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"wildcard": {"publisher": {"value": "*jednota"}}}
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents],
            [23, 29, 30, 31, 32],
        )

    def test_search_by_signature_contains(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [{"wildcard": {"signature": {"value": "*1003*"}}}]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 45)

    def test_search_by_sysno_not_contains(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must_not": [{"wildcard": {"sysno": {"value": "*01-*"}}}]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 26)
        self.assertEqual(documents[1]["id"], 27)

    def test_search_by_creator_not_equals(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must_not": [{"term": {"added_by": "test_user"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 21)

    def test_search_by_barcode_is_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must_not": [{"exists": {"field": "barcode"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 26)
        self.assertEqual(documents[1]["id"], 27)

    def test_search_by_bundle_is_not_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {"bool": {"must": [{"exists": {"field": "bundle"}}]}},
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 11)
        self.assertEqual(
            [document["id"] for document in documents],
            [23, 29, 30, 31, 32, 38, 39, 40, 41, 42, 45],
        )

    def test_search_by_page_count_equal_to(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": [{"term": {"page_count": {"value": 480}}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 15)

    def test_search_by_page_count_manual_not_equal_to(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must_not": [{"term": {"page_count_manual": 1}}],
                    "must": {"exists": {"field": "page_count_manual"}},
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents], [6, 22, 40, 41, 42]
        )

    def test_search_by_page_count_predicted_less_than(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [{"range": {"page_count_predicted": {"lte": 100}}}]
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 7)
        self.assertEqual(
            [document["id"] for document in documents],
            [38, 39, 40, 41, 42, 45, 46],
        )

    def test_search_by_page_count_predicted_between(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "range": {
                                "page_count_predicted": {
                                    "gte": 100,
                                    "lte": 200,
                                }
                            }
                        }
                    ]
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents], [33, 34, 35, 36, 37]
        )

    def test_search_by_page_count_catalog_more_than(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [{"range": {"page_count_predicted": {"gte": 300}}}]
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents], [23, 29, 30, 31, 32]
        )

    def test_search_by_page_count_is_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must_not": [{"exists": {"field": "page_count"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 3)
        self.assertEqual(
            [document["id"] for document in documents], [16, 17, 18]
        )

    def test_search_by_page_count_manual_is_not_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": [{"exists": {"field": "page_count_manual"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 7)
        self.assertEqual(
            [document["id"] for document in documents],
            [6, 22, 26, 27, 40, 41, 42],
        )

    def test_search_by_category_is_in(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "nested": {
                                "path": "category_path",
                                "query": {
                                    "terms": {"category_path.category_id": [2]}
                                },
                            }
                        },
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents], [28, 29, 30, 31, 32]
        )

    def test_search_by_category_is_not_in(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must_not": [
                        {
                            "nested": {
                                "path": "category_path",
                                "query": {
                                    "terms": {"category_path.category_id": [2]}
                                },
                            }
                        },
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 41)
        self.assertEqual(
            [document["id"] for document in documents],
            list(range(1, 28)) + list(range(33, 47)),
        )

    def test_search_by_category_is_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must_not": [{"exists": {"field": "category_id"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 28)
        self.assertEqual(
            [document["id"] for document in documents],
            list(range(14, 28)) + list(range(33, 47)),
        )

    def test_search_by_category_is_not_null(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {"must": [{"exists": {"field": "category_id"}}]}
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 18)
        self.assertEqual(
            [document["id"] for document in documents],
            list(range(1, 14)) + list(range(28, 33)),
        )

    def test_search_by_digitization_state_in_progress(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "digitization_state": {"value": "InProgress"}
                            }
                        }
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 4)
        self.assertEqual(documents[1]["id"], 5)

    def test_search_by_issuance_type_not_a_unit(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must_not": [
                        {"term": {"issuance_type": {"value": "Unit"}}}
                    ]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 26)
        for document in documents:
            self.assertNotEqual(document["issuance_type"], "Unit")

    def test_search_by_location_match(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [{"regexp": {"signature": {"value": "2-.*"}}}]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 33)
        for document in documents:
            self.assertRegex(document["signature"], "^2-.*")

    def test_search_by_location_not_match(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must_not": [{"regexp": {"signature": {"value": "2-.*"}}}]
                }
            },
            "size": 50,
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 13)
        for document in documents:
            self.assertNotRegex(document["signature"], "^2-.*")

    def test_search_match_all(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"issuance_type": "Unit"}},
                        {"wildcard": {"publishing_place": "*Praha*"}},
                        {"range": {"page_count_catalog": {"gt": 200}}},
                        {
                            "nested": {
                                "path": "category_path",
                                "query": {
                                    "terms": {"category_path.category_id": [4]}
                                },
                            }
                        },
                        {"term": {"publishing_year": "1969"}},
                    ]
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 8)

    def test_search_match_any(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "should": [
                        {"term": {"cnb": "cnb000424990"}},
                        {"term": {"sysno": "MZK01-001371756"}},
                        {"term": {"title": "Vlaky celého světa /"}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 3)
        self.assertEqual(documents[0]["id"], 11)
        self.assertEqual(documents[1]["id"], 15)
        self.assertEqual(documents[2]["id"], 8)

    def test_search_by_username(self):
        # Arange
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"added_by": "vera_admin"}},
                    ],
                }
            }
        }

        # Act
        response = self.client.post(
            "/documents/query",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        documents = [hit["_source"] for hit in response.json()["hits"]["hits"]]

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 21)
