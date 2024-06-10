from tests.test_integration import TestIntegration

from security.models import Role, Action
from security.types import ActionType
from helper_funcs import mock_db, mockUser, createTestUser


class TestRolesEndpoints(TestIntegration):

    def test_get_roles(self):
        # Arrange
        mock_db(
            [
                Role(id=2, name="role 2"),
                Role(id=3, name="role 3"),
                Role(id=4, name="role 4"),
                Action(role_id=2, action=ActionType.WriteDatatable),
                Action(role_id=3, action=ActionType.Extract),
                Action(role_id=4, action=ActionType.ReadDatatableAll),
            ]
        )
        mockUser(createTestUser([ActionType.EditAccess]))

        # Act
        response = self.client.get(
            "/roles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        print(response.json())
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
