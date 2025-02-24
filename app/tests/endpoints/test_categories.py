from .base import TestEndpointsBase
from datetime import date, timedelta

from models import (
    Category,
    CategoryDepartments,
    Distribution,
    DigitizationList,
    Intention,
    Extraction,
    Document,
    CatalogRecord,
    Department,
    User,
)

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestCategoriesEndpoints(TestEndpointsBase):
    def setUp(self):
        super().setUp()

        self.session.add_all(
            [
                Category(
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Department(
                    name="Test Department",
                    abbreviation="TST",
                ),
                User(
                    username="test_user",
                    department_id=1,
                ),
                CategoryDepartments(
                    category_id=1,
                    department_id=1,
                ),
            ]
        )
        self.session.flush()

    def test_create_root_category(self):
        # Arrange
        name = "Test New Root Category Name"
        description = "Test New Root Category Description"
        category_json = {"name": name, "description": description}

        # Act
        response = self.client.post(
            "/categories/root", json=category_json, headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(response.json()["level"], 0)
        self.assertFalse(response.json()["assignable"])
        self.assertIsNone(response.json()["percentage"])
        self.assertFalse(response.json()["disabled"], False)

    def test_create_department_category(self):
        # Arrange
        name = "Test Department Category Name"
        description = "Test Department Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.post(
            "/categories/1", json=category_json, headers=self.json_headers
        )

        # Assert
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["parent_id"], 1)
        self.assertEqual(response.json()["level"], 1)
        self.assertFalse(response.json()["assignable"])
        self.assertIsNone(response.json()["percentage"])
        self.assertFalse(response.json()["disabled"], 0)

    def test_create_category_unique_name_violation(self):
        # Arrange
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        category_json = {
            "name": name,
            "description": description,
        }

        # Act
        response = self.client.post(
            "/categories/root", json=category_json, headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 409)

    def test_update_category(self):
        # Arrange
        category_id = 1
        name = "Test Category Name"
        description = "Test Category Description"
        category_json = {
            "name": name,
            "description": description,
        }

        # Act
        response = self.client.put(
            f"/categories/{category_id}",
            json=category_json,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["level"], 0)
        self.assertFalse(response.json()["assignable"])
        self.assertIsNone(response.json()["percentage"])
        self.assertFalse(response.json()["disabled"], 0)

    def test_delete_category(self):
        # Act
        response = self.client.delete(
            "/categories/1", headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)


class TestCategoriesDistributionEndpoints(TestEndpointsBase):
    def setUp(self):
        super().setUp()

        self.session.add_all(
            [
                Category(
                    name="Root Category",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Category 1",
                    parent_id=1,
                    level=1,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Category 21",
                    parent_id=2,
                    level=2,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Category 22",
                    parent_id=2,
                    level=2,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Category 23",
                    parent_id=2,
                    level=2,
                    assignable=False,
                    extract_whole=False,
                ),
                Intention(
                    name="Test Intention",
                    target_page_count=125000,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=30),
                ),
                Distribution(
                    intention_id=1,
                    category_id=1,
                    percentage=100.0,
                ),
                Distribution(
                    intention_id=1,
                    category_id=2,
                    percentage=100.0,
                ),
                Distribution(
                    intention_id=1,
                    category_id=3,
                    percentage=50.0,
                ),
                Distribution(
                    intention_id=1,
                    category_id=4,
                    percentage=50.0,
                ),
                Department(
                    name="Test Department",
                    abbreviation="TST",
                ),
                User(
                    username="test_user",
                    department_id=1,
                ),
                CategoryDepartments(
                    category_id=2,
                    department_id=1,
                ),
            ]
        )
        self.session.flush()
        self.session.add_all(
            [
                DigitizationList(
                    intention_id=1,
                    created_by="test_user",
                ),
                CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
                Document(
                    sysno="test_sysno",
                    volume="test_volume",
                    barcode="test_barcode",
                    category_id=4,
                    pages_count_catalog=125,
                    digitization_list_id=1,
                ),
                Extraction(
                    document_ids=[1],
                    selected_pages=125,
                    target_pages=500,
                    include_categories=[],
                    location_ids=[],
                    target_pages_threshold=0.05,
                    whole_categories_threshold=0.05,
                    generated_by="test_user",
                ),
            ]
        )
        self.session.flush()

    def test_update_distribution_on_root(self):
        # Arrange
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 1, "percentage": 100.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/root/distribution",
            json=distribution,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        response_json = response.json()

        self.assertEqual(len(response_json), 1)
        self.assertEqual(response_json[0]["id"], 1)
        self.assertEqual(response_json[0]["intention_id"], 1)
        self.assertEqual(response_json[0]["percentage"], 100.0)

    def test_update_distribution_on_level_1(self):
        # Arrange
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 2, "percentage": 100.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/1/distribution",
            json=distribution,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        response_json = response.json()

        self.assertEqual(len(response_json), 1)
        self.assertEqual(response_json[0]["id"], 2)
        self.assertEqual(response_json[0]["intention_id"], 1)
        self.assertEqual(response_json[0]["percentage"], 100.0)

    def test_update_distribution_on_level_2(self):
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 20.0},
                {"category_id": 5, "percentage": 10.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/2/distribution",
            json=distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        response_json = response.json()

        self.assertEqual(len(response_json), 3)
        self.assertEqual(response_json[0]["id"], 3)
        self.assertEqual(response_json[0]["intention_id"], 1)
        self.assertEqual(response_json[0]["percentage"], 70.0)
        self.assertEqual(response_json[1]["id"], 4)
        self.assertEqual(response_json[1]["intention_id"], 1)
        self.assertEqual(response_json[1]["percentage"], 20.0)
        self.assertEqual(response_json[2]["id"], 5)
        self.assertEqual(response_json[2]["intention_id"], 1)
        self.assertEqual(response_json[2]["percentage"], 10.0)

    def test_update_distribution_fail_on_invalid_sum(self):
        # Arrange
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.1},
                {"category_id": 4, "percentage": 20.0},
                {"category_id": 5, "percentage": 10.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/2/distribution",
            json=distribution,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Percentage of all categories on one level has to sum to 100.",
            response.json()["detail"],
        )

    def test_update_distribution_and_automatically_add_missing_category(self):
        # Arrange
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 30.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/2/distribution",
            json=distribution,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertEqual(len(response.json()), 3)
        self.assertEqual(response.json()[0]["id"], 3)
        self.assertEqual(response.json()[0]["percentage"], 70)
        self.assertEqual(response.json()[1]["id"], 4)
        self.assertEqual(response.json()[1]["percentage"], 30)
        self.assertEqual(response.json()[2]["id"], 5)
        self.assertEqual(response.json()[2]["percentage"], 0)

    def test_update_distribution_fail_because_of_excessive_category(self):
        # Arrange
        distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 10.0},
                {"category_id": 5, "percentage": 10.0},
                {"category_id": 6, "percentage": 10.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/2/distribution",
            json=distribution,
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Percentage distribution contains categories "
            "that do not belong to the parent category.",
            response.json()["detail"],
        )

    def test_delete_category_in_distribution_fail(self):
        # Arrange
        Distribution(intention_id=1, category_id=3, percentage=70.0).save(
            self.session
        )

        # Act
        response = self.client.delete(
            "/categories/3", headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Only categories that have percentage distribution 0 "
            "can be deleted",
        )

    def test_get_root_categories(self):
        # Act
        response = self.client.get("/categories", headers=self.json_headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 1)
        self.assertEqual(response.json()[0]["level"], 0)

    def test_get_department_categories(self):
        # Act
        response = self.client.get(
            "/categories/departments/1", headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)

    def test_remove_from_intention(self):
        # Act
        response = self.client.delete(
            "/categories/2/in_intention/1", headers=self.json_headers
        )

        # Assert
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["category_id"], 2)
        self.assertEqual(response.json()["percentage"], 100.0)
        self.assertIsNone(
            Distribution.find(self.session, intention_category_id=(1, 2))
        )

    def test_get_root_categories_for_intention(self):
        # Act
        response = self.client.get(
            "/categories/in_intention/1", headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 1)
        self.assertEqual(response.json()[0]["level"], 0)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(len(response.json()[0]["sub_categories"]), 1)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            125000,
        )
        self.assertEqual(
            len(response.json()[0]["sub_categories"][0]["sub_categories"]), 3
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][0]["sub_categories"][1][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertIsNone(
            response.json()[0]["sub_categories"][0]["sub_categories"][2][
                "pages_needed_to_meet_intention"
            ]
        )

    def test_get_root_categories_for_extraction(self):
        # Act
        response = self.client.get(
            "/categories/in_intention/1/by_extraction/1",
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 1)
        self.assertEqual(response.json()[0]["level"], 0)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(len(response.json()[0]["sub_categories"]), 1)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            125000,
        )
        self.assertEqual(
            len(response.json()[0]["sub_categories"][0]["sub_categories"]), 3
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][0]["sub_categories"][1][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertIsNone(
            response.json()[0]["sub_categories"][0]["sub_categories"][2][
                "pages_needed_to_meet_intention"
            ]
        )

    def test_get_root_categories_for_digitization(self):
        # Act
        response = self.client.get(
            "/categories/in_intention/1/by_digitizations",
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 1)
        self.assertEqual(response.json()[0]["level"], 0)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(response.json()[0]["digitized_pages"], 125)
        self.assertEqual(len(response.json()[0]["sub_categories"]), 1)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            125000,
        )
        self.assertEqual(
            len(response.json()[0]["sub_categories"][0]["sub_categories"]), 3
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        category_22 = response.json()[0]["sub_categories"][0][
            "sub_categories"
        ][1]
        self.assertEqual(
            category_22["pages_needed_to_meet_intention"],
            62500,
        )
        self.assertEqual(
            category_22["digitized_pages"],
            125,
        )

    def test_get_department_categories_for_intention(self):
        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1",
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][1][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertIsNone(
            response.json()[0]["sub_categories"][2][
                "pages_needed_to_meet_intention"
            ]
        )

    def test_get_department_categories_for_extraction(self):
        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1/by_extraction/1",
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertEqual(
            response.json()[0]["sub_categories"][1][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        self.assertIsNone(
            response.json()[0]["sub_categories"][2][
                "pages_needed_to_meet_intention"
            ]
        )

    def test_get_department_categories_for_digitization(self):
        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1/by_digitizations",
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(
            response.json()[0]["pages_needed_to_meet_intention"], 125000
        )
        self.assertEqual(response.json()[0]["digitized_pages"], 125)
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)
        self.assertEqual(
            response.json()[0]["sub_categories"][0][
                "pages_needed_to_meet_intention"
            ],
            62500,
        )
        category_22 = response.json()[0]["sub_categories"][1]
        self.assertEqual(
            category_22["pages_needed_to_meet_intention"],
            62500,
        )
        self.assertEqual(
            category_22["digitized_pages"],
            125,
        )
        self.assertIsNone(
            response.json()[0]["sub_categories"][2][
                "pages_needed_to_meet_intention"
            ]
        )
