from tests.test_endpoints import TestEndpoints
from datetime import date, timedelta

from helper_funcs import (
    createTestUser,
    mockUser,
    mock_db,
    get_all_actions_except,
)

from categories.categories.models import (
    Category,
    CategoryDepartments,
    Distribution,
)
from categories.intentions.models import Intention
from security.models import Department
from security.types import ActionType


class TestCategoriesEndpoints(TestEndpoints):
    def test_create_root_category_permitted(self):
        # Arrange
        mock_db()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        name = "Test Root Category Name"
        description = "Test Root Category Description"
        category_json = {"name": name, "description": description}

        # Act
        response = self.client.post(
            "/categories/root",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(response.json()["level"], 0)
        self.assertFalse(response.json()["assignable"])
        self.assertNotIn("percentage", response.json())
        self.assertFalse(response.json()["disabled"], False)

    def test_create_category_permitted_for_user_department(self):
        # Arrange
        mock_db(
            [
                Category(
                    # id=1,
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Department(
                    id=1,
                    name="Test Department",
                    abbreviation="TST",
                    users=["test_user"],
                ),
                CategoryDepartments(
                    category_id=1,
                    department_id=1,
                ),
            ]
        )
        test_user = createTestUser(
            [ActionType.EditCategoriesDepartment], department_id=1
        )
        mockUser(test_user)

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
            "/categories/1",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["parent_id"], 1)
        self.assertEqual(response.json()["level"], 1)
        self.assertFalse(response.json()["assignable"])
        self.assertNotIn("percentage", response.json())
        self.assertFalse(response.json()["disabled"], 0)

    def test_create_category_permitted_for_different_department(self):
        # Arrange
        mock_db(
            [
                Category(
                    # id=1,
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Department(
                    id=1,
                    name="Test Department",
                    abbreviation="TST",
                    users=["test_user"],
                ),
                CategoryDepartments(
                    category_id=1,
                    department_id=1,
                ),
            ]
        )
        test_user = createTestUser([ActionType.EditCategoriesDepartment])
        mockUser(test_user)

        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.post(
            "/categories/root",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_create_category_prohibited_but_with_user_department(self):
        # Arrange
        mock_db(
            [
                Category(
                    # id=1,
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Department(
                    id=1,
                    name="Test Department",
                    abbreviation="TST",
                    users=["test_user"],
                ),
                CategoryDepartments(
                    category_id=1,
                    department_id=1,
                ),
            ]
        )
        test_user = createTestUser(
            get_all_actions_except(
                [
                    ActionType.EditCategoriesDepartment,
                    ActionType.EditCategoriesAll,
                ]
            )
        )
        mockUser(test_user)

        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_create_category_unique_name_violation(self):
        # Arrange
        mock_db(
            [
                Category(
                    # id=1,
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
            ]
        )
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.post(
            "/categories/root",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 409)

    def test_update_category_permitted(self):
        # Arrange
        mock_db(
            [
                Category(
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Test Category Old Name",
                    description="Test Category Old Description",
                    parent_id=1,
                    level=1,
                    assignable=False,
                    extract_whole=False,
                ),
            ]
        )
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        category_id = 2
        name = "Test Category Name"
        description = "Test Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.put(
            f"/categories/{category_id}",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["parent_id"], 1)
        self.assertEqual(response.json()["level"], 1)
        self.assertFalse(response.json()["assignable"])
        self.assertNotIn("percentage", response.json())
        self.assertFalse(response.json()["disabled"], 0)

    def test_update_category_prohibited(self):
        # Arrange
        mock_db(
            [
                Category(
                    name="Test Root Category Name",
                    description="Test Root Category Description",
                    parent_id=None,
                    level=0,
                    assignable=False,
                    extract_whole=False,
                ),
                Category(
                    name="Test Category Old Name",
                    description="Test Category Old Description",
                    parent_id=1,
                    level=1,
                    assignable=False,
                    extract_whole=False,
                ),
            ]
        )
        test_user = createTestUser()
        mockUser(test_user)

        category_id = 2
        name = "Test Category Name"
        description = "Test Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        # Act
        response = self.client.put(
            f"/categories/{category_id}",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def mock_db_for_distribution_test(self):
        mock_db(
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
                Department(
                    name="Test Department",
                    abbreviation="TST",
                    users=["test_user"],
                ),
                CategoryDepartments(
                    category_id=2,
                    department_id=1,
                ),
            ]
        )

    def test_update_distribution_permitted(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        root_distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 1, "percentage": 100.0},
            ],
        }
        level1_distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 2, "percentage": 100.0},
            ],
        }
        level2_distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 20.0},
                {"category_id": 5, "percentage": 10.0},
            ],
        }

        # Act
        response_root = self.client.put(
            "/categories/root/distribution",
            json=root_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_level1 = self.client.put(
            "/categories/1/distribution",
            json=level1_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_level2 = self.client.put(
            "/categories/2/distribution",
            json=level2_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_root.status_code, 200)
        self.assertEqual(response_level1.status_code, 200)
        self.assertEqual(response_level2.status_code, 200)

        response_root_json = response_root.json()
        self.assertEqual(len(response_root_json), 1)
        self.assertEqual(response_root_json[0]["category_id"], 1)
        self.assertEqual(response_root_json[0]["intention_id"], 1)
        self.assertEqual(response_root_json[0]["percentage"], 100.0)

        response_level1_json = response_level1.json()
        self.assertEqual(len(response_level1_json), 1)
        self.assertEqual(response_level1_json[0]["category_id"], 2)
        self.assertEqual(response_level1_json[0]["intention_id"], 1)
        self.assertEqual(response_level1_json[0]["percentage"], 100.0)

        response_level2_json = response_level2.json()
        self.assertEqual(len(response_level2_json), 3)
        self.assertEqual(response_level2_json[0]["category_id"], 3)
        self.assertEqual(response_level2_json[0]["intention_id"], 1)
        self.assertEqual(response_level2_json[0]["percentage"], 70.0)
        self.assertEqual(response_level2_json[1]["category_id"], 4)
        self.assertEqual(response_level2_json[1]["intention_id"], 1)
        self.assertEqual(response_level2_json[1]["percentage"], 20.0)
        self.assertEqual(response_level2_json[2]["category_id"], 5)
        self.assertEqual(response_level2_json[2]["intention_id"], 1)
        self.assertEqual(response_level2_json[2]["percentage"], 10.0)

    def test_update_distribution_permitted_invalid_sum(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        level2_distribution = {
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
            json=level2_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Percentage of all categories on one level has to sum to 100.",
            response.json()["detail"],
        )

    def test_update_distribution_permitted_missing_category(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        level2_distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 30.0},
            ],
        }

        # Act
        response = self.client.put(
            "/categories/2/distribution",
            json=level2_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Percentage distribution does not contains "
            "all children from one parent",
            response.json()["detail"],
        )

    def test_update_distribution_permitted_excessive_category(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        level2_distribution = {
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
            json=level2_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Percentage distribution contains categories "
            "that do not belong to the category.",
            response.json()["detail"],
        )

    def test_delete_category_permitted(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        # Act
        response = self.client.delete(
            "/categories/2",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_delete_category_in_distribution_permitted_fail(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))
        level2_distribution = {
            "intention_id": 1,
            "distributions": [
                {"category_id": 3, "percentage": 70.0},
                {"category_id": 4, "percentage": 20.0},
                {"category_id": 5, "percentage": 10.0},
            ],
        }

        # Act
        self.client.put(
            "/categories/2/distribution",
            json=level2_distribution,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response = self.client.delete(
            "/categories/3",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_get_root_categories_permitted_all(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 1)
        self.assertEqual(response.json()[0]["level"], 0)

    def test_get_department_categories_permitted_all(self):
        # Arrange
        self.mock_db_for_distribution_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/departments/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)

    def test_get_root_categories_prohibited_all(self):
        # Arrange
        mockUser(createTestUser())

        # Act
        response = self.client.get(
            "/categories",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def mock_db_for_distribution_and_intention_test(self):
        mock_db(
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
                Department(
                    name="Test Department",
                    abbreviation="TST",
                    users=["test_user"],
                ),
                CategoryDepartments(
                    category_id=2,
                    department_id=1,
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
            ]
        )

    def test_remove_from_intention_permitted_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        # Act
        response = self.client.delete(
            "/categories/2/intentions/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertListEqual(
            [d["category_id"] for d in response.json()], [2, 3, 4]
        )

    def test_get_root_categories_for_intention_permitted_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/intentions/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
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
            len(response.json()[0]["sub_categories"][0]["sub_categories"]), 2
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

    def test_get_department_categories_for_intention_permitted_department(
        self,
    ):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesDepartment], 1))

        # Act
        response = self.client.get(
            "/categories/departments/2",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["id"], 2)
        self.assertEqual(response.json()[0]["level"], 1)
        self.assertEqual(len(response.json()[0]["sub_categories"]), 3)
