from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestRolesEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_create_role_permission(self):
        self.assertEndpointPermission(
            "POST", "/roles", ActionType.EditAccess, success_status_code=422
        )
