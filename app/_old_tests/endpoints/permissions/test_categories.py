from .base import TestEndpointsPermissionsBase
from models import (
    Category,
    CategoryDepartments,
    Department,
    User,
)
from datatypes import ActionType


class TestCategoriesEndpoints(TestEndpointsPermissionsBase):
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

    def test_create_root_category_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/categories/root",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def test_create_category_for_user_department_prohibited(self):
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
        self.assertEndpointProhited(
            "POST",
            "/categories/category",
            [
                ActionType.EditCategoriesDepartment,
                ActionType.EditCategoriesAll,
            ],
        )

    def test_update_category_permission(self):
        self.assertEndpointPermitted(
            "PUT",
            "/categories/2",
            ActionType.EditCategoriesAll,
            expected_status_code=422,
        )
        self.assertEndpointProhited(
            "POST",
            "/categories/category",
            [
                ActionType.EditCategoriesDepartment,
                ActionType.EditCategoriesAll,
            ],
        )

    def test_update_distribution_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/categories/root/distribution",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def test_delete_category_permission(self):
        self.assertEndpointPermission(
            "DELETE",
            "/categories/1",
            ActionType.EditCategoriesAll,
            success_status_code=404,
        )

    def test_get_root_categories_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/categories",
            ActionType.ReadCategoriesAll,
        )

    def test_remove_from_intention_permission(self):
        self.assertEndpointPermission(
            "DELETE",
            "/categories/2/in_intention/1",
            ActionType.EditCategoriesAll,
            success_status_code=404,
        )

    def test_get_root_categories_for_intention_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/categories/in_intention/1",
            ActionType.ReadCategoriesAll,
        )

    def test_get_root_categories_for_extraction_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/categories/in_intention/1/by_extraction/1",
            ActionType.ReadCategoriesAll,
            success_status_code=404,
        )

    def test_get_root_categories_for_digitization_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/categories/in_intention/1/by_digitizations",
            ActionType.ReadCategoriesAll,
        )

    def test_get_department_categories_for_intention_permission(self):
        self.assertEndpointPermitted(
            "GET",
            "/categories/departments/1/in_intention/1",
            ActionType.ReadCategoriesDepartment,
        )
        self.assertEndpointProhited(
            "GET",
            "/categories/departments/1/in_intention/1",
            [
                ActionType.ReadCategoriesDepartment,
                ActionType.ReadCategoriesAll,
            ],
        )

    def test_get_department_categories_for_extraction_permission(self):
        self.assertEndpointPermitted(
            "GET",
            "/categories/departments/1/in_intention/1/by_extraction/1",
            ActionType.ReadCategoriesDepartment,
            expected_status_code=404,
        )
        self.assertEndpointProhited(
            "GET",
            "/categories/departments/1/in_intention/1/by_extraction/1",
            [
                ActionType.ReadCategoriesDepartment,
                ActionType.ReadCategoriesAll,
            ],
        )

    def test_get_department_categories_for_digitization_permission_all(self):
        self.assertEndpointPermitted(
            "GET",
            "/categories/departments/1/in_intention/1/by_digitizations",
            ActionType.ReadCategoriesDepartment,
        )
        self.assertEndpointProhited(
            "GET",
            "/categories/departments/1/in_intention/1/by_digitizations",
            [
                ActionType.ReadCategoriesDepartment,
                ActionType.ReadCategoriesAll,
            ],
        )
