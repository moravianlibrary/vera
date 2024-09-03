from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestDepartmentsEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_create_department_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/departments",
            ActionType.EditAccess,
            success_status_code=422,
        )
