from ..base import TestEndpointsBase
from datatypes import ActionType


class TestRolesEndpointsPermissions(TestEndpointsBase):
    def test_create_role_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.EditAccess])
        # Act
        response = self.client.post("/roles", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 422)

    def test_create_role_prohibited(self):
        # Arrange
        self.mockTestAntiUser([ActionType.EditAccess])
        # Act
        response = self.client.post("/roles", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 403)
