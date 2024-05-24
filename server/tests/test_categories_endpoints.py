from tests.test_endpoints import TestEndpoints
from unittest.mock import Mock, patch
from helper_funcs import (
    createTestUser,
    mockUser,
)

from categories.categories.schemas import Category as CategorySchema
from categories.categories.models import Category, CategoryDepartments
from security.types import ActionType


class TestCategoriesEndpoints(TestEndpoints):
    @patch.object(Category, "find_by_name_and_parent_id")
    def test_create_root_category_permitted(
        self,
        mock_find_by_name_and_parent_id: Mock,
    ):
        # Arrange
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        name = "Test Root Category Name"
        description = "Test Root Category Description"
        category_json = {"name": name, "description": description}

        mock_find_by_name_and_parent_id.return_value = None

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
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(response.json()["level"], 0)
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(response.json()["percentage"], 0)
        self.assertFalse(response.json()["disabled"], 0)

    # @patch("categories.router.crud.create_category")
    # @patch("categories.router.crud.get_category_departments")
    # @patch("categories.router.get_category_subtree")
    # @patch("categories.router.has_unique_name")
    # def test_create_category_permitted_for_user_department(
    #     self,
    #     mock_has_unique_name: Mock,
    #     mock_get_category_subtree: Mock,
    #     mock_get_category_departments: Mock,
    #     mock_create_category: Mock,
    # ):
    #     # Arrange
    #     test_user = createTestUser([ActionType.EditCategoriesDepartment])
    #     mockUser(test_user)

    #     name = "Test Root Category Name"
    #     description = "Test Root Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_has_unique_name.return_value = True
    #     mock_get_category_departments.return_value = [
    #         CategoryDepartments(
    #             category_id=parent_id,
    #             department_id=test_user.department_id,
    #         )
    #     ]
    #     mock_create_category.return_value = CategorySchema(
    #         id=2, name=name, description=description, parent_id=1, level=1
    #     )
    #     mock_get_category_subtree.return_value = createTestCategoryNode(
    #         id=2,
    #         name=name,
    #         description=description,
    #         parent_id=1,
    #         level=1,
    #     )

    #     # Act
    #     response = self.client.post(
    #         "/categories/category",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 200)
    #     self.assertEqual(response.json()["id"], 2)
    #     self.assertEqual(response.json()["name"], name)
    #     self.assertEqual(response.json()["description"], description)
    #     self.assertEqual(response.json()["parent_id"], 1)
    #     self.assertEqual(response.json()["level"], 1)
    #     self.assertFalse(response.json()["assignable"])
    #     self.assertEqual(response.json()["percentage"], 0)
    #     self.assertFalse(response.json()["disabled"], 0)

    # @patch("categories.router.crud.get_category_departments")
    # @patch("categories.router.has_unique_name")
    # def test_create_category_permitted_for_different_department(
    #     self,
    #     mock_has_unique_name: Mock,
    #     mock_get_category_departments: Mock,
    # ):
    #     # Arrange
    #     test_user = createTestUser([ActionType.EditCategoriesDepartment])
    #     mockUser(test_user)

    #     name = "Test Root Category Name"
    #     description = "Test Root Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_has_unique_name.return_value = True
    #     mock_get_category_departments.return_value = [
    #         CategoryDepartments(
    #             category_id=parent_id,
    #             department_id=11,
    #         )
    #     ]

    #     # Act
    #     response = self.client.post(
    #         "/categories/category",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 403)

    # @patch("categories.crud.get_category_departments")
    # @patch("categories.router.has_unique_name")
    # def test_create_category_prohibited_but_with_user_department(
    #     self,
    #     mock_has_unique_name,
    #     mock_get_category_departments,
    # ):
    #     # Arrange
    #     test_user = createTestUser(
    #         get_all_actions_except(
    #             [
    #                 ActionType.EditCategoriesDepartment,
    #                 ActionType.EditCategoriesAll,
    #             ]
    #         )
    #     )
    #     mockUser(test_user)

    #     name = "Test Root Category Name"
    #     description = "Test Root Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_has_unique_name.return_value = True
    #     mock_get_category_departments.return_value = [
    #         CategoryDepartments(
    #             category_id=parent_id,
    #             department_id=test_user.department_id,
    #         )
    #     ]

    #     # Act
    #     response = self.client.post(
    #         "/categories/category",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 403)

    # @patch("categories.router.has_unique_name")
    # def test_create_category_unique_name_violation(
    #     self, mock_has_unique_name: Mock
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))

    #     name = "Test Root Category Name"
    #     description = "Test Root Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_has_unique_name.return_value = False

    #     # Act
    #     response = self.client.post(
    #         "/categories/category",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 409)

    # @patch("categories.router.has_unique_name")
    # @patch("categories.crud.get_category")
    # @patch("categories.crud.update_category")
    # def test_update_category_permitted(
    #     self,
    #     mock_update_category: Mock,
    #     mock_get_category: Mock,
    #     mock_has_unique_name: Mock,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     category_id = 2
    #     old_name = "Test Category Old Name"
    #     name = "Test Category Name"
    #     description = "Test Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_has_unique_name.return_value = True
    #     mock_get_category.return_value = CategorySchema(
    #         id=category_id,
    #         name=old_name,
    #         description=description,
    #         parent_id=1,
    #         level=1,
    #     )
    #     mock_update_category.return_value = CategorySchema(
    #         id=category_id,
    #         name=name,
    #         description=description,
    #         parent_id=1,
    #         level=1,
    #     )

    #     # Act
    #     response = self.client.put(
    #         f"/categories/category/{category_id}",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 200)
    #     self.assertEqual(response.json()["id"], 2)
    #     self.assertEqual(response.json()["name"], name)
    #     self.assertEqual(response.json()["description"], description)
    #     self.assertEqual(response.json()["parent_id"], 1)
    #     self.assertEqual(response.json()["level"], 1)
    #     self.assertFalse(response.json()["assignable"])
    #     self.assertEqual(response.json()["percentage"], 0)
    #     self.assertFalse(response.json()["disabled"], 0)

    # @patch("categories.crud.get_category")
    # @patch("categories.crud.get_category_departments")
    # def test_update_category_prohibited(
    #     self,
    #     mock_get_category_departments: Mock,
    #     mock_get_category: Mock,
    # ):
    #     # Arrange
    #     test_user = createTestUser()
    #     mockUser(test_user)

    #     category_id = 2
    #     name = "Test Category Name"
    #     description = "Test Category Description"
    #     parent_id = 1
    #     category_json = {
    #         "name": name,
    #         "description": description,
    #         "parent_id": parent_id,
    #     }

    #     mock_get_category.return_value = CategorySchema(
    #         id=category_id,
    #         name=name,
    #         description=description,
    #         parent_id=1,
    #         level=1,
    #     )

    #     mock_get_category_departments.return_value = [
    #         CategoryDepartments(
    #             category_id=category_id,
    #             department_id=test_user.department_id,
    #         )
    #     ]

    #     # Act
    #     response = self.client.put(
    #         f"/categories/category/{category_id}",
    #         json=category_json,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 403)

    # @patch("categories.router.crud.get_enabled_for_parent")
    # @patch("categories.router.crud.update_distribution")
    # def test_update_distribution_permitted(
    #     self,
    #     mock_update_distribution: Mock,
    #     mock_get_enabled_for_parent: Mock,
    # ):
    #     from categories.schemas import Category

    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     input_data = [
    #         {"id": 2, "percentage": 50.0},
    #         {"id": 3, "percentage": 50.0},
    #     ]
    #     child_categories = [
    #         CategorySchema(
    #             id=2,
    #             name="Test Category 1",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #         Category(
    #             id=3,
    #             name="Test Category 2",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #     ]

    #     mock_get_enabled_for_parent.return_value = child_categories
    #     mock_update_distribution.return_value = None

    #     # Act
    #     response = self.client.put(
    #         "/categories/distribution?parent_id=1",
    #         json=input_data,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 200)

    # @patch("categories.router.crud.get_enabled_for_parent")
    # @patch("categories.router.crud.update_distribution")
    # def test_update_distribution_permitted_invalid_sum(
    #     self,
    #     mock_update_distribution: Mock,
    #     mock_get_enabled_for_parent: Mock,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     input_data = [
    #         {"id": 2, "percentage": 50.0},
    #         {"id": 3, "percentage": 40.0},
    #     ]
    #     child_categories = [
    #         CategorySchema(
    #             id=2,
    #             name="Test Category 1",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #         CategorySchema(
    #             id=3,
    #             name="Test Category 2",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #     ]

    #     mock_get_enabled_for_parent.return_value = child_categories
    #     mock_update_distribution.return_value = None

    #     # Act
    #     response = self.client.put(
    #         "/categories/distribution?parent_id=1",
    #         json=input_data,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(400, response.status_code)
    #     self.assertEqual(
    #         "Percentage of all categories on one level has to sum to 100.",
    #         response.json()["detail"],
    #     )

    # @patch("categories.router.crud.get_enabled_for_parent")
    # @patch("categories.router.crud.update_distribution")
    # def test_update_distribution_permitted_missing_category(
    #     self,
    #     mock_update_distribution: Mock,
    #     mock_get_enabled_for_parent: Mock,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     input_data = [
    #         {"id": 2, "percentage": 50.0},
    #         {"id": 3, "percentage": 50.0},
    #     ]
    #     child_categories = [
    #         CategorySchema(
    #             id=2,
    #             name="Test Category 1",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #         CategorySchema(
    #             id=3,
    #             name="Test Category 2",
    #             level=1,
    #             parent_id=1,
    #             percentage=30,
    #         ),
    #         CategorySchema(
    #             id=4,
    #             name="Test Category 3",
    #             level=1,
    #             parent_id=1,
    #             percentage=20,
    #         ),
    #     ]

    #     mock_get_enabled_for_parent.return_value = child_categories
    #     mock_update_distribution.return_value = None

    #     # Act
    #     response = self.client.put(
    #         "/categories/distribution?parent_id=1",
    #         json=input_data,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(400, response.status_code)
    #     self.assertEqual(
    #         "Percentage distribution does not contains "
    #         "all children from one parent",
    #         response.json()["detail"],
    #     )

    # @patch("categories.router.crud.get_enabled_for_parent")
    # @patch("categories.router.crud.update_distribution")
    # def test_update_distribution_permitted_excessive_category(
    #     self,
    #     mock_update_distribution: Mock,
    #     mock_get_enabled_for_parent: Mock,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     input_data = [
    #         {"id": 2, "percentage": 100.0},
    #     ]
    #     child_categories = [
    #         CategorySchema(
    #             id=2,
    #             name="Test Category 1",
    #             level=1,
    #             parent_id=1,
    #             percentage=50,
    #         ),
    #         CategorySchema(
    #             id=3,
    #             name="Test Category 2",
    #             level=1,
    #             parent_id=1,
    #             percentage=30,
    #         ),
    #     ]

    #     mock_get_enabled_for_parent.return_value = child_categories
    #     mock_update_distribution.return_value = None

    #     # Act
    #     response = self.client.put(
    #         "/categories/distribution?parent_id=1",
    #         json=input_data,
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(400, response.status_code)
    #     self.assertEqual(
    #         "Percentage distribution does not contains "
    #         "all children from one parent",
    #         response.json()["detail"],
    #     )

    # @patch("categories.router.crud.get_category")
    # @patch("categories.router.crud.delete_category")
    # def test_delete_category_permitted(
    #     self,
    #     mock_delete_category,
    #     mock_get_category,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.EditCategoriesAll]))
    #     test_category = CategorySchema(
    #         id=2,
    #         name="Test Category 1",
    #         level=1,
    #         parent_id=1,
    #         percentage=0,
    #     )

    #     mock_get_category.return_value = test_category
    #     mock_delete_category.return_value = test_category

    #     # Act
    #     response = self.client.delete(
    #         "/categories/category/2",
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 200)

    # @patch("categories.router.crud.get_root_categories")
    # @patch("categories.router.crud.get_category_departments")
    # @patch("categories.router.crud.get_children_categories")
    # @patch("categories.router.crud.get_pages_count")
    # @patch("categories.router.crud.get_documents_without_cnb_count")
    # @patch("categories.router.crud.get_documents_count")
    # def test_get_root_categories_permitted_all(
    #     self,
    #     mock_get_documents_count,
    #     mock_get_documents_without_cnb_count,
    #     mock_get_pages_count,
    #     mock_get_children_categories,
    #     mock_get_category_departments,
    #     mock_get_root_categories,
    # ):
    #     # Arrange
    #     mockUser(createTestUser([ActionType.ReadCategoriesAll]))
    #     test_root_category = [
    #         CategorySchema(
    #             id=1,
    #             name="Test Root Category 1",
    #             level=0,
    #             parent_id=None,
    #             percentage=0,
    #         ),
    #         CategorySchema(
    #             id=2,
    #             name="Test Root Category 2",
    #             level=0,
    #             parent_id=None,
    #             percentage=0,
    #         ),
    #     ]

    #     mock_get_root_categories.return_value = test_root_category
    #     mock_get_category_departments.return_value = []
    #     mock_get_children_categories.return_value = []
    #     mock_get_pages_count.return_value = 0
    #     mock_get_documents_count.return_value = 0
    #     mock_get_documents_without_cnb_count.return_value = 0

    #     client = createTestClient()

    #     # Act
    #     response = client.get(
    #         "/categories",
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 200)
    #     for node in response.json():
    #         self.assertIn(node["id"], [1, 2])
    #         self.assertEqual(node["level"], 0)

    # def test_get_root_categories_prohibited_all(self):
    #     # Arrange
    #     mockUser(createTestUser())

    #     # Act
    #     response = self.client.get(
    #         "/categories",
    #         headers={
    #             "Authorization": "Bearer test_token",
    #             "Content-Type": "application/json",
    #         },
    #     )

    #     # Assert
    #     self.assertEqual(response.status_code, 403)
