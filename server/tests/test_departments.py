import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from helper_funcs import setUpEnv


class TestDepartmentsEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from vera import app

        self.client = TestClient(app)
        from services.database import get_db

        self.db = next(get_db())

        from departments.crud import create_department
        from departments.schemas import DepartmentCreate

        self.name = "Test Department"
        self.abbreviation = "TD"
        self.delete_department_by_name(self.name)
        self.department_id = create_department(
            DepartmentCreate(name=self.name, abbreviation=self.abbreviation),
            self.db,
        ).id

    def delete_department_by_name(self, name: str):
        from departments.crud import get_departments, delete_department

        for department in get_departments(self.db):
            if name == department.name:
                delete_department(department.id, self.db)

    def tearDown(self):
        try:
            from departments.crud import delete_department

            delete_department(self.department_id, self.db)
        except Exception:
            pass

    def test_create_department(self):
        name = "New Test Department"
        abbreviation = "NTD"
        response = self.client.post(
            "/departments", json={"name": name, "abbreviation": abbreviation}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()["name"])
        self.assertEqual(abbreviation, response.json()["abbreviation"])
        self.delete_department_by_name(name)

    def test_update_department(self):
        name = "Updated Department"
        abbreviation = "UD"
        response = self.client.put(
            f"/departments/{self.department_id}",
            json={"name": name, "abbreviation": abbreviation},
        )
        self.delete_department_by_name(name)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.department_id, response.json()["id"])
        self.assertEqual(name, response.json()["name"])
        self.assertEqual(abbreviation, response.json()["abbreviation"])

    def test_delete_department(self):
        response = self.client.delete(f"/departments/{self.department_id}")
        self.assertEqual(response.status_code, 200)
        from departments.crud import get_departments

        self.assertFalse(
            self.department_id
            in [department.id for department in get_departments(self.db)]
        )

    def test_add_user_to_department(self):
        name = "New Test Department"
        abbreviation = "NTD"
        self.delete_department_by_name(name)

        response = self.client.post(
            "/departments", json={"name": name, "abbreviation": abbreviation}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()["name"])
        self.assertEqual(abbreviation, response.json()["abbreviation"])
        document_id = response.json()["id"]

        username = "test_user"
        response = self.client.put(
            f"/departments/{document_id}/user", params={"username": username}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(username in response.json()["users"])
        response = self.client.delete(
            f"/departments/{document_id}/user", params={"username": username}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["users"], [])
        self.delete_department_by_name(name)

    def test_get_departments(self):
        from departments import crud
        from departments.schemas import Department

        test_departments = [
            Department(id=1, name="Department 1", abbreviation="D1"),
            Department(id=2, name="Department 2", abbreviation="D2"),
            Department(id=3, name="Department 3", abbreviation="D3"),
        ]
        result_departments = [
            {
                "id": 1,
                "name": "Department 1",
                "abbreviation": "D1",
                "users": [],
            },
            {
                "id": 2,
                "name": "Department 2",
                "abbreviation": "D2",
                "users": [],
            },
            {
                "id": 3,
                "name": "Department 3",
                "abbreviation": "D3",
                "users": [],
            },
        ]
        crud.get_departments = MagicMock(return_value=test_departments)
        response = self.client.get("/departments")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_departments, response.json())
