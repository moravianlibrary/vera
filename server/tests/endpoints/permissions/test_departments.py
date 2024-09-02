from ..base import TestEndpointsBase
from datatypes import ActionType


class TestDepartmentsEndpointsPermissions(TestEndpointsBase):
    def test_create_department_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.EditAccess])
        # Act
        response = self.client.post(
            "/departments",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        # Assert
        self.assertEqual(422, response.status_code)

    def test_create_department_prohibited(self):
        # Arrange
        self.mockTestAntiUser([ActionType.EditAccess])
        # Act
        response = self.client.post(
            "/departments",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        # Assert
        self.assertEqual(403, response.status_code)
