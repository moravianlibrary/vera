from .base import TestEndpointsPermissionsBase
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
from datatypes import ActionType


class TestCategoriesEndpoints(TestEndpointsPermissionsBase):
    def test_create_root_category_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/categories/root",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def get_testing_models(self):
        return [
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

    def test_create_category_for_user_department_prohibited(self):
        # Arrange
        self.session.add_all(self.get_testing_models())
        # Act and Assert
        self.assertEndpointProhited(
            "POST",
            "/categories/root",
            [
                ActionType.EditCategoriesDepartment,
                ActionType.EditCategoriesAll,
            ],
        )

    def test_create_category_for_different_department_prohibited(self):
        # Arrange
        self.session.add_all(self.get_testing_models())
        self.session.add(
            Department(name="Test Department 2", abbreviation="TST2")
        )
        user = User.get(self.session, "test_user")
        user.department_id = 2
        user.save(self.session)
        # Act and Assert
        self.assertEndpointProhited(
            "POST",
            "/categories/1",
            [
                ActionType.EditCategoriesDepartment,
                ActionType.EditCategoriesAll,
            ],
        )

    def test_create_category_but_with_user_department_prohibited(self):
        # Arrange
        self.session.add_all(self.get_testing_models())
        # Act and Assert
        self.assertEndpointProhited(
            "POST",
            "/categories/category",
            [
                ActionType.EditCategoriesDepartment,
                ActionType.EditCategoriesAll,
            ],
        )

    def test_update_category_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/categories/2",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def test_update_distribution_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/categories/root/distribution",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    # TODO: Fix rest of these tests
    def test_update_distribution_permission_missing_category(self):
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
        self.assertEqual(200, response.status_code)
        self.assertEqual(len(response.json()), 3)
        self.assertEqual(response.json()[0]["id"], 3)
        self.assertEqual(response.json()[0]["percentage"], 70)
        self.assertEqual(response.json()[1]["id"], 4)
        self.assertEqual(response.json()[1]["percentage"], 30)
        self.assertEqual(response.json()[2]["id"], 5)
        self.assertEqual(response.json()[2]["percentage"], 0)

    def test_update_distribution_permission_excessive_category(self):
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

    def test_delete_category_permission(self):
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

    def test_delete_category_in_distribution_permission_fail(self):
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

    def test_get_root_categories_permission_all(self):
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

    def test_get_department_categories_permission_all(self):
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
                    id=1,
                    name="Test Intention",
                    target_page_count=125000,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=30),
                ),
                Department(
                    name="Test Department",
                    abbreviation="TST",
                ),
                User(username="test_user", department_id=1),
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
                DigitizationList(
                    intention_id=1,
                    extractor="test_user",
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

    def test_remove_from_intention_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(
            createTestUser(
                [ActionType.EditCategoriesAll, ActionType.ReadCategoriesAll]
            )
        )

        # Act
        response_deletion = self.client.delete(
            "/categories/2/in_intention/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_get = self.client.get(
            "/categories/in_intention/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response_deletion.status_code, 200)
        self.assertEqual(response_deletion.json()["category_id"], 2)
        self.assertEqual(response_deletion.json()["percentage"], 100.0)
        self.assertEqual(response_get.status_code, 200)
        self.assertListEqual([d["id"] for d in response_get.json()], [1])
        self.assertIsNone(
            response_get.json()[0]["sub_categories"][0]["intention_id"]
        )

    def test_get_root_categories_for_intention_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/in_intention/1",
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

    def test_get_root_categories_for_extraction_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/in_intention/1/by_extraction/1",
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

    def test_get_root_categories_for_digitization_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/in_intention/1/by_digitizations",
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

    def test_get_department_categories_for_intention_permission_department(
        self,
    ):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesDepartment], 1))

        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1",
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

    def test_get_department_categories_for_extraction_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1/by_extraction/1",
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

    def test_get_department_categories_for_digitization_permission_all(self):
        # Arrange
        self.mock_db_for_distribution_and_intention_test()
        mockUser(createTestUser([ActionType.ReadCategoriesAll]))

        # Act
        response = self.client.get(
            "/categories/departments/1/in_intention/1/by_digitizations",
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
