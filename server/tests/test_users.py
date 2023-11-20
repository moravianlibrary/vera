import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from helper_funcs import setUpEnv


class TestUsersEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())

        from auth.crud import create_user
        from auth.schemas import UserCreate
        self.username = "Test User"
        self.password = "Test Password"
        self.delete_user_by_username(self.username)
        self.user_id = create_user(
            UserCreate(username=self.username,
                       password=self.password),
            self.db).id
        from roles.crud import create_role
        from roles.schemas import RoleCreate
        self.role_name = "Test Role"
        self.delete_role_by_name(self.role_name)
        self.role_id = create_role(
            RoleCreate(name=self.role_name,
                       actions=[]),
            self.db).id
        from departments.crud import create_department
        from departments.schemas import DepartmentCreate
        self.department_name = "Test Department"
        self.department_abbreviation = "TD"
        self.delete_department_by_name(self.department_name)
        self.department_id = create_department(
            DepartmentCreate(name=self.department_name,
                             abbreviation=self.department_abbreviation),
            self.db).id

    def delete_user_by_username(self, username: str):
        from users.crud import get_users, delete_user
        for user in get_users(self.db):
            if username == user.username:
                delete_user(user.id, self.db)

    def delete_role_by_name(self, name: str):
        from roles.crud import get_roles, delete_role
        for role in get_roles(self.db):
            if name == role.name:
                delete_role(role.id, self.db)

    def delete_department_by_name(self, name: str):
        from departments.crud import get_departments, delete_department
        for department in get_departments(self.db):
            if name == department.name:
                delete_department(department.id, self.db)

    def tearDown(self):
        try:
            from users.crud import delete_user
            delete_user(self.user_id, self.db)
            from roles.crud import delete_role
            delete_role(self.role_id, self.db)
            from departments.crud import delete_department
            delete_department(self.department_id, self.db)
        except Exception:
            pass

    def test_update_user(self):
        username = "Updated User"
        response = self.client.put(f"/users/{self.user_id}",
                                   json={"username": username,
                                         "role_id": self.role_id,
                                         "department_id": self.department_id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user_id, response.json()['id'])
        self.assertEqual(username, response.json()['username'])
        self.assertEqual(self.role_name, response.json()['role_name'])
        self.assertEqual(self.department_name,
                         response.json()['department_name'])
        self.assertEqual(self.department_abbreviation,
                         response.json()['department_abbreviation'])

    def test_delete_user(self):
        response = self.client.delete(f"/users/{self.user_id}")
        self.assertEqual(response.status_code, 200)
        from users.crud import get_users
        self.assertFalse(self.user_id in [user.id for user
                                          in get_users(self.db)])

    def test_get_users(self):
        from users import crud
        from users.schemas import User
        test_users = [
            User(id=2, username="User 2", department_id=1,
                 department_name="Test department",
                 department_abbreviation="TD",
                 role_id=1,
                 role_name="Test Role"),
            User(id=3, username="User 3", department_id=1,
                 department_name="Test department",
                 department_abbreviation="TD",
                 role_id=1,
                 role_name="Test Role")
        ]
        result_users = {"users": [
            {"id": 2, "username": "User 2", "department_id": 1,
             "department_name": "Test department",
             "department_abbreviation": "TD",
             "role_id": 1,
             "role_name": "Test Role"},
            {"id": 3, "username": "User 3", "department_id": 1,
             "department_name": "Test department",
             "department_abbreviation": "TD",
             "role_id": 1,
             "role_name": "Test Role"}
            ],
                        "num_found": 2}
        crud.get_users = MagicMock(return_value=test_users)
        response = self.client.get("/users")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_users, response.json())


if __name__ == '__main__':
    unittest.main()
