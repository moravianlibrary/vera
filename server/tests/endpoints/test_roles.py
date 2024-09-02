from .base import TestEndpointsBase
from models import Role
from datatypes import ActionType


class TestRolesEndpoints(TestEndpointsBase):
    def test_create_role(self):
        # Arrange
        role = {
            "name": "Test Role",
            "actions": [ActionType.WriteDatatable.value],
        }

        # Act
        response = self.client.post(
            "/roles", json=role, headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], role["name"])
        self.assertEqual(response.json()["actions"], role["actions"])

    def test_get_roles(self):
        # Arrange
        self.session.add_all(
            [
                Role(id=2, name="role 2", actions=[ActionType.WriteDatatable]),
                Role(id=3, name="role 3", actions=[ActionType.Extract]),
                Role(
                    id=4, name="role 4", actions=[ActionType.ReadDatatableAll]
                ),
            ]
        )

        # Act
        response = self.client.get(
            "/roles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        expected_roles = [
            {
                "id": 2,
                "name": "role 2",
                "actions": [ActionType.WriteDatatable.value],
            },
            {"id": 3, "name": "role 3", "actions": [ActionType.Extract.value]},
            {
                "id": 4,
                "name": "role 4",
                "actions": [ActionType.ReadDatatableAll.value],
            },
        ]
        response_roles = response.json()
        for expected_role, actual_role in zip(expected_roles, response_roles):
            self.assertEqual(expected_role["id"], actual_role["id"])
            self.assertEqual(expected_role["name"], actual_role["name"])
            self.assertListEqual(
                expected_role["actions"], actual_role["actions"]
            )
