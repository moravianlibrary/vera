from os import environ
import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


def setUpEnv():
    environ["POSTGRES_HOST"] = "localhost"
    environ["JWT_SECRET_KEY"] = "MJJLWBd3FGfDddqkUC4qE+VX5HYexVK6hLkieod5aGQ="
    environ["JWT_ALGORITHM"] = "HS256"
    environ["ALLOW_ORIGINS"] = "http://localhost:3000"
    environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "300"
    environ["TIMEZONE"] = "Europe/Prague"
    environ["ADMIN_USERNAME"] = "admin"
    environ["ADMIN_PASSWORD"] = "digiboardAdmin"


class TestAuthEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()

        from digiboard import app
        self.client = TestClient(app)

        from services.database import get_db
        from auth import auth, router, schemas

        self.username = "test_user"
        self.password = "test_password"
        try:
            self.tearDown()
        except Exception:
            pass

        self.user_id = router.register(schemas.UserCreate(
            username=self.username,
            password=self.password,
        ), next(get_db())).id

        self.access_token, _ = auth.create_access_token(
            data={"sub": self.username}
        )

    def tearDown(self):
        from auth.crud import get_user_by_username
        from users.crud import delete_user
        from services.database import get_db

        db = next(get_db())

        user_id = get_user_by_username(self.username, db).id
        delete_user(user_id, db)

    def test_register_existing_user(self):
        # Test registering a user that already exists
        response = self.client.post("/auth/register", json={
            "username": "test_user",
            "password": "test_password"
        })
        # Expecting a 403 Forbidden status code
        assert response.status_code == 403
        self.assertEqual(environ["ACCESS_TOKEN_EXPIRE_MINUTES"], "300")

    def test_successful_login(self):
        # Test a successful login
        response = self.client.post("/auth/login", json={
            "username": self.username,
            "password": self.password
        })
        assert response.status_code == 200  # Expecting a 200 OK status code
        # Expecting an access token in the response
        assert "access_token" in response.json()

    def test_current_user(self):
        response = self.client.get(
            "/auth/current_user",
            headers={"Authorization": f"Bearer {self.access_token}"})
        assert response.status_code == 200  # Expecting a 200 OK status code
        # Expecting user data in the response
        assert "username" in response.json()

    def test_change_password(self):
        response = self.client.put(
            "/auth/change_password",
            headers={"Authorization": f"Bearer {self.access_token}"},
            json={"id": self.user_id,
                  "old_password": self.password,
                  "new_password": "newpassword"
                  })
        assert response.status_code == 200  # Expecting a 200 OK status code
        # Expecting user data in the response
        assert "username" in response.json()


class TestCategoriesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())

        from categories.crud import create_category
        from categories.schemas import CategoryCreate
        self.name = "Test Category"
        self.delete_category_by_name(self.name)
        self.category_id = create_category(CategoryCreate(name=self.name),
                                           self.db).id

    def delete_category_by_name(self, name: str):
        from categories.crud import get_categories, delete_category
        for category in get_categories(self.db):
            if name == category.name:
                delete_category(category.id, self.db)

    def tearDown(self):
        try:
            from categories.crud import delete_category
            delete_category(self.category_id, self.db)
        except Exception:
            pass

    def test_create_category(self):
        name = "Test Category Name"
        self.delete_category_by_name(name)
        response = self.client.post("/categories", json={"name": name})
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()['name'])
        self.delete_category_by_name(name)

    def test_update_category(self):
        updated_name = "Updated Test Category"
        response = self.client.put(f"/categories/{self.category_id}",
                                   json={"name": updated_name})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.category_id, response.json()['id'])
        self.assertEqual(updated_name, response.json()['name'])

    def test_delete_category(self):
        response = self.client.delete(f"/categories/{self.category_id}")
        self.assertEqual(response.status_code, 200)

    def test_get_categories(self):
        from categories import crud
        from categories.schemas import Category
        test_categories = [Category(id=1, name="Category 1"),
                           Category(id=2, name="Category 2"),
                           Category(id=3, name="Category 3")]
        result_categories = [{"id": 1, "name": "Category 1"},
                             {"id": 2, "name": "Category 2"},
                             {"id": 3, "name": "Category 3"}]
        crud.get_categories = MagicMock(return_value=test_categories)
        response = self.client.get("/categories")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_categories, response.json())


class TestDepartmentsEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())

        from departments.crud import create_department
        from departments.schemas import DepartmentCreate
        self.name = "Test Department"
        self.abbreviation = "TD"
        self.delete_department_by_name(self.name)
        self.department_id = create_department(
            DepartmentCreate(name=self.name,
                             abbreviation=self.abbreviation),
            self.db).id

    def delete_department_by_name(self, name: str):
        from departments.crud import get_departments, delete_department
        for department in get_departments(self.db):
            if name == department.name:
                delete_department(department.id, self.db)

    def tearDown(self):
        try:
            from categories.crud import delete_category
            delete_category(self.category_id, self.db)
        except Exception:
            pass

    def test_create_department(self):
        name = "New Test Department"
        abbreviation = "NTD"
        response = self.client.post("/departments",
                                    json={"name": name,
                                          "abbreviation": abbreviation})
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()['name'])
        self.assertEqual(abbreviation, response.json()['abbreviation'])
        self.delete_department_by_name(name)

    def test_update_department(self):
        name = "Updated Department"
        abbreviation = "UD"
        response = self.client.put(f"/departments/{self.department_id}",
                                   json={"name": name,
                                         "abbreviation": abbreviation})
        self.delete_department_by_name(name)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.department_id, response.json()['id'])
        self.assertEqual(name, response.json()['name'])
        self.assertEqual(abbreviation, response.json()['abbreviation'])

    def test_delete_department(self):
        response = self.client.delete(f"/departments/{self.department_id}")
        self.assertEqual(response.status_code, 200)
        from departments.crud import get_departments
        self.assertFalse(self.department_id in [department.id for department
                                                in get_departments(self.db)])

    def test_get_departments(self):
        from departments import crud
        from departments.schemas import Department
        test_departments = [
            Department(id=1, name="Department 1", abbreviation="D1"),
            Department(id=2, name="Department 2", abbreviation="D2"),
            Department(id=3, name="Department 3", abbreviation="D3")
        ]
        result_departments = [
            {"id": 1, "name": "Department 1", "abbreviation": "D1"},
            {"id": 2, "name": "Department 2", "abbreviation": "D2"},
            {"id": 3, "name": "Department 3", "abbreviation": "D3"}
        ]
        crud.get_departments = MagicMock(return_value=test_departments)
        response = self.client.get("/departments")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_departments, response.json())


if __name__ == '__main__':
    unittest.main()
