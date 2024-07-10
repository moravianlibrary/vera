from tests.test_integration import TestIntegration
from tests.helper_funcs import (
    createTestUser,
    mockUser,
    mock_db,
)
from tests.documents_bank import (
    get_test_documents,
    get_test_documents_with_extraction,
    get_test_documents_with_locations,
)

from schemas.types.action_type import ActionType


class TestDocumentsSearch(TestIntegration):
    def test_sort_by_barcode(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"sort": {"field": "Barcode", "order": "Ascending"}}

        # Act
        response = self.client.post(
            "/documents/query?limit=5",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(documents[0]["barcode"], "2610051177")
        self.assertEqual(documents[1]["barcode"], "2610051177")
        self.assertEqual(documents[2]["barcode"], "2610086535")
        self.assertEqual(documents[3]["barcode"], "2610140568")
        self.assertEqual(documents[4]["barcode"], "2610145323")

    def test_sort_by_barcode_desc(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"sort": {"field": "Barcode", "order": "Descending"}}

        # Act
        response = self.client.post(
            "/documents/query?limit=5",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(documents[0]["barcode"], None)
        self.assertEqual(documents[1]["barcode"], None)
        self.assertEqual(documents[2]["barcode"], "BC-2489007")
        self.assertEqual(documents[3]["barcode"], "BC-2489006")
        self.assertEqual(documents[4]["barcode"], "BC-2489005")

    def test_search_by_phrase(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"search_phrase": "26100"}

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 3)
        self.assertEqual(documents[0]["barcode"], "2610051177")
        self.assertEqual(documents[1]["barcode"], "2610051177")
        self.assertEqual(documents[2]["barcode"], "2610086535")

    def test_search_by_id_list(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"id_list": [923, 924, 925]}

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 3)
        self.assertEqual(documents[0]["id"], 925)
        self.assertEqual(documents[1]["id"], 924)
        self.assertEqual(documents[2]["id"], 923)

    def test_search_by_title_starts_with(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Title",
                        "option": "StartsWith",
                        "value": "Zakázanou",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 915)
        self.assertEqual(documents[1]["id"], 913)

    def test_search_by_title_equals(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PublishingPlace",
                        "option": "Equals",
                        "value": "Praha :",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 19)
        self.assertEqual(
            [document["id"] for document in documents],
            [
                925,
                915,
                913,
                911,
                910,
                909,
                904,
                902,
                893,
                892,
                891,
                890,
                889,
                888,
                854,
                853,
                852,
                851,
                738,
            ],
        )

    def test_search_by_publisher_ends_with(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Publisher",
                        "option": "EndsWith",
                        "value": "jednota,",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents],
            [889, 854, 853, 852, 851],
        )

    def test_search_by_signature_contains(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Signature",
                        "option": "Contains",
                        "value": "1036",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 891)

    def test_search_by_sysno_not_contains(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Sysno",
                        "option": "NotContains",
                        "value": "01-",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 886)
        self.assertEqual(documents[1]["id"], 885)

    def test_search_by_creator_not_equals(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Creator",
                        "option": "NotEquals",
                        "value": "randiak",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 895)

    def test_search_by_barcode_is_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Barcode",
                        "option": "IsNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 886)
        self.assertEqual(documents[1]["id"], 885)

    def test_search_by_bundle_is_not_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Bundle",
                        "option": "IsNotNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 11)
        self.assertEqual(
            [document["id"] for document in documents],
            [889, 854, 853, 852, 851, 840, 839, 835, 834, 833, 738],
        )

    def test_search_by_page_count_equal_to(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCount",
                        "option": "EqualTo",
                        "value": 357,
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 925)

    def test_search_by_page_count_manual_not_equal_to(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCountManual",
                        "option": "NotEqualTo",
                        "value": 1,
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents],
            [911, 892, 835, 834, 833],
        )

    def test_search_by_page_count_predicted_less_than(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCountPredicted",
                        "option": "LessThan",
                        "value": 100,
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 7)
        self.assertEqual(
            [document["id"] for document in documents],
            [840, 839, 835, 834, 833, 738, 697],
        )

    def test_search_by_page_count_predicted_between(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCountPredicted",
                        "option": "Between",
                        "value": [100, 200],
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents],
            [845, 844, 843, 842, 841],
        )

    def test_search_by_page_count_catalog_more_than(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCountCatalog",
                        "option": "MoreThan",
                        "value": 400,
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 4)
        self.assertEqual(
            [document["id"] for document in documents], [911, 902, 892, 830]
        )

    def test_search_by_page_count_is_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCount",
                        "option": "IsNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 3)
        self.assertEqual(
            [document["id"] for document in documents], [901, 900, 899]
        )

    def test_search_by_page_count_manual_is_not_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "PagesCountManual",
                        "option": "IsNotNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 7)
        self.assertEqual(
            [document["id"] for document in documents],
            [911, 892, 886, 885, 835, 834, 833],
        )

    def test_search_by_category_is_in(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {"field": "Category", "option": "IsIn", "value": [1, 2, 3]}
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 5)
        self.assertEqual(
            [document["id"] for document in documents],
            [861, 854, 853, 852, 851],
        )

    def test_search_by_category_is_not_in(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Category",
                        "option": "IsNotIn",
                        "value": [1, 2, 3, 5],
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 7)
        self.assertEqual(
            [document["id"] for document in documents],
            [910, 909, 908, 907, 906, 905, 904],
        )

    def test_search_by_category_is_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Category",
                        "option": "IsNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 32)

    def test_search_by_category_is_not_null(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Category",
                        "option": "IsNotNull",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 18)

    def test_search_by_digitization_state_in_progress(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "DigitizationState",
                        "option": "Is",
                        "value": "InProgress",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0]["id"], 915)
        self.assertEqual(documents[1]["id"], 913)

    def test_search_by_issuance_type_not_a_unit(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "IssuanceType",
                        "option": "IsNot",
                        "value": "Unit",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 20)

    def test_search_by_location_match(self):
        # Arange
        mock_db(get_test_documents_with_locations())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Location",
                        "option": "Match",
                        "value": [2],
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 34)
        for document in documents:
            self.assertRegex(document["signature"], "^2-.*")

    def test_search_by_location_not_match(self):
        # Arange
        mock_db(get_test_documents_with_locations())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Location",
                        "option": "NotMatch",
                        "value": [2],
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 16)
        for document in documents:
            self.assertNotRegex(document["signature"], "^2-.*")

    def test_search_by_location_not_match_invalid(self):
        # Arange
        mock_db(get_test_documents_with_locations())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "Location",
                        "option": "NotMatch",
                    }
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 0)

    def test_search_match_all(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAll",
                "sub_rules": [
                    {
                        "field": "IssuanceType",
                        "option": "Is",
                        "value": "Unit",
                    },
                    {
                        "field": "PublishingPlace",
                        "option": "Contains",
                        "value": "Praha",
                    },
                    {
                        "field": "PagesCountCatalog",
                        "option": "MoreThan",
                        "value": 200,
                    },
                    {
                        "field": "Category",
                        "option": "IsIn",
                        "value": [4],
                    },
                    {
                        "field": "PublishingYear",
                        "option": "Equals",
                        "value": "1969",
                    },
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 909)

    def test_search_match_any(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {
            "search_group": {
                "option": "MatchAny",
                "sub_rules": [
                    {
                        "field": "Cnb",
                        "option": "Equals",
                        "value": "cnb000424990",
                    },
                    {
                        "field": "Sysno",
                        "option": "Equals",
                        "value": "MZK01-001371756",
                    },
                    {
                        "field": "Title",
                        "option": "Equals",
                        "value": "Vlaky celého světa /",
                    },
                ],
            }
        }

        # Act
        response = self.client.post(
            "/documents/query?limit=50",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 3)
        self.assertEqual(documents[0]["id"], 909)
        self.assertEqual(documents[1]["id"], 906)
        self.assertEqual(documents[2]["id"], 902)

    def test_search_by_username(self):
        # Arange
        mock_db(get_test_documents())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"username": "vera_admin"}

        # Act
        response = self.client.post(
            "/documents/query?limit=5",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 895)

    def test_search_extracted(self):
        # Arange
        mock_db(get_test_documents_with_extraction())
        test_user = createTestUser([ActionType.ReadDatatableAll])
        mockUser(test_user)

        query = {"extracted": True}

        # Act
        response = self.client.post(
            "/documents/query?limit=5",
            headers={"Authorization": "Bearer test_token"},
            json=query,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        documents = response.json()["documents"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["id"], 1001)
