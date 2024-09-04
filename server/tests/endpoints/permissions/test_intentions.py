from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestIntentionsEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_create_intention_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/intentions",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def test_update_intention_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/intentions/1",
            ActionType.EditCategoriesAll,
            success_status_code=422,
        )

    def test_delete_intention_permission(self):
        self.assertEndpointPermission(
            "DELETE",
            "/intentions/1",
            ActionType.EditCategoriesAll,
            success_status_code=404,
        )

    def test_get_intention_permission(self):
        self.assertEndpointPermitted(
            "GET",
            "/intentions/1",
            ActionType.ReadCategoriesAll,
            expected_status_code=404,
        )
        self.assertEndpointPermitted(
            "GET",
            "/intentions/1",
            ActionType.ReadCategoriesDepartment,
            expected_status_code=404,
        )
        self.assertEndpointProhited(
            "GET",
            "/intentions/1",
            [
                ActionType.ReadCategoriesAll,
                ActionType.ReadCategoriesDepartment,
            ],
        )

    def test_get_intentions_permission(self):
        self.assertEndpointPermitted(
            "GET", "/intentions", ActionType.ReadCategoriesAll
        )
        self.assertEndpointPermitted(
            "GET", "/intentions", ActionType.ReadCategoriesDepartment
        )
        self.assertEndpointProhited(
            "GET",
            "/intentions",
            [
                ActionType.ReadCategoriesAll,
                ActionType.ReadCategoriesDepartment,
            ],
        )
