import unittest
from fastapi.testclient import TestClient
from helper_funcs import setUpEnv


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
