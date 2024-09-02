from .base import TestEndpointsBase


class TestDepartmentsEndpoints(TestEndpointsBase):
    def test_create_department(self):
        # Arrange
        self.mockTestSuperUser()
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "users": ["Test User 1", "Test User 2"],
        }

        # Act
        response = self.client.post(
            "/departments",
            json=department_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
