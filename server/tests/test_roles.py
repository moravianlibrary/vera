import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from helper_funcs import setUpEnv


class TestRolesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from vera import app

        self.client = TestClient(app)
        from services.database import get_db

        self.db = next(get_db())

        from roles.crud import create_role
        from roles.schemas import RoleCreate
        from roles.types import ActionType

        self.name = "Test Role"
        self.actions = [ActionType.WriteDatatable]
        self.delete_role_by_name(self.name)
        self.role_id = create_role(
            RoleCreate(name=self.name, actions=self.actions), self.db
        ).id

    def delete_role_by_name(self, name: str):
        from roles.crud import get_roles, delete_role

        for role in get_roles(self.db):
            if name == role.name:
                delete_role(role.id, self.db)

    def tearDown(self):
        try:
            from roles.crud import delete_role

            delete_role(self.role_id, self.db)
        except Exception:
            pass

    def test_create_role(self):
        from roles.types import ActionType

        name = "New Test Role"
        actions = [ActionType.WriteDatatable.value]
        self.delete_role_by_name(name)
        response = self.client.post(
            "/roles", json={"name": name, "actions": actions}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()["name"])
        self.delete_role_by_name(name)

    def test_update_role(self):
        from roles.types import ActionType

        name = "Updated Role"
        actions = [ActionType.Extract.value]
        response = self.client.put(
            f"/roles/{self.role_id}", json={"name": name, "actions": actions}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.role_id, response.json()["id"])
        self.assertEqual(name, response.json()["name"])

    def test_delete_role(self):
        response = self.client.delete(f"/roles/{self.role_id}")
        self.assertEqual(response.status_code, 200)
        from roles.crud import get_roles

        self.assertFalse(
            self.role_id in [role.id for role in get_roles(self.db)]
        )

    def test_get_roles(self):
        from roles import crud
        from roles.schemas import Role
        from roles.types import ActionType

        test_roles = [
            Role(id=2, name="role 2"),
            Role(id=3, name="role 3"),
            Role(id=4, name="role 4"),
        ]
        test_actions = lambda role_id, db: (
            [ActionType.WriteDatatable]
            if role_id == 2
            else (
                [ActionType.Extract]
                if role_id == 3
                else [ActionType.ReadDatatableAll] if role_id == 4 else []
            )
        )
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
        crud.get_roles = MagicMock(return_value=test_roles)
        crud.get_role_actions = MagicMock(side_effect=test_actions)
        response = self.client.get("/roles")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_roles, response.json())


if __name__ == "__main__":
    unittest.main()
