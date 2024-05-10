from tests.test_endpoints import TestEndpoints
from unittest.mock import Mock, patch

from roles.models import Role as RoleModel
from auth.types import ActionType


class TestRolesEndpoints(TestEndpoints):

    @patch("roles.crud.get_roles")
    @patch("roles.crud.get_role_actions")
    def test_get_roles(self, get_role_actions: Mock, get_roles: Mock):
        # Arrange
        get_roles.return_value = [
            RoleModel(id=2, name="role 2"),
            RoleModel(id=3, name="role 3"),
            RoleModel(id=4, name="role 4"),
        ]
        get_role_actions.side_effect = lambda role_id, db: (
            [ActionType.WriteDatatable]
            if role_id == 2
            else (
                [ActionType.Extract]
                if role_id == 3
                else [ActionType.ReadDatatableAll] if role_id == 4 else []
            )
        )

        # Act
        response = self.client.get(
            "/roles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        result_roles = [
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
        self.assertEquals(result_roles, response.json())
