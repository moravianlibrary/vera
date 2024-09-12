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

    def test_update_role(self):
        # Arrange
        self.session.add(
            Role(id=1, name="role 1", actions=[ActionType.WriteDatatable])
        )
        self.session.flush()
        role_update = {
            "name": "updated role 1",
            "actions": [ActionType.InsertDatatable.value],
        }

        # Act
        response = self.client.put(
            "/roles/1", json=role_update, headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], role_update["name"])
        self.assertEqual(response.json()["actions"], role_update["actions"])

    def test_delete_role(self):
        # Arrange
        self.session.add(
            Role(id=1, name="role 1", actions=[ActionType.WriteDatatable])
        )
        self.session.flush()

        # Act
        response = self.client.delete("/roles/1", headers=self.json_headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(Role.find(self.session, 1))

    def test_get_role(self):
        # Arrange
        self.session.add(
            Role(id=1, name="role 1", actions=[ActionType.WriteDatatable])
        )
        self.session.flush()

        # Act
        response = self.client.get("/roles/1", headers=self.json_headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "role 1")
        self.assertEqual(
            response.json()["actions"], [ActionType.WriteDatatable.value]
        )

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
        self.session.flush()
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

        # Act
        response = self.client.get(
            "/roles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(expected_roles), len(body))
        for expected_role, actual_role in zip(expected_roles, body):
            self.assertEqual(expected_role["id"], actual_role["id"])
            self.assertEqual(expected_role["name"], actual_role["name"])
            self.assertListEqual(
                expected_role["actions"], actual_role["actions"]
            )
