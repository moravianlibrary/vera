from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestUsersEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_get_users_permission(self):
        self.assertEndpointPermission("GET", "/users", ActionType.EditAccess)

    def test_emulate_access_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/users/current/emulate",
            ActionType.EditAccess,
            success_status_code=422,
        )

    def test_stop_emulation_permission(self):
        self.assertEndpointPermission(
            "DELETE",
            "/users/current/emulate",
            ActionType.EditAccess,
            success_status_code=404,
        )
