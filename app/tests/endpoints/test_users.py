from .base import TestEndpointsBase
from datatypes import ActionType
from models import Role, User


class TestUsersEndpoints(TestEndpointsBase):
    def tearDown(self) -> None:
        from routers.utils.access_emulation import emulated_users

        super().tearDown()
        emulated_users.clear()

    def test_get_current_user(self):
        # Arange
        self.mockTestUser(settings={"personalization": {"key": "value"}})

        # Act
        response = self.client.get("/users/current", headers=self.headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "test_user")
        self.assertEqual(
            response.json()["settings"], {"personalization": {"key": "value"}}
        )

    def test_set_current_user_settings(self):
        # Arange
        self.session.add(User(username="test_user"))
        self.session.flush()

        # Act
        response = self.client.post(
            "/users/current/settings",
            headers=self.headers,
            json={"personalization": {"key": "value"}},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "test_user")
        self.assertEqual(
            response.json()["settings"], {"personalization": {"key": "value"}}
        )

    def test_get_users(self):
        # Arange
        self.session.add_all(
            [User(username="test_user_1"), User(username="test_user_2")]
        )
        self.session.flush()

        # Act
        response = self.client.get("/users", headers=self.headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertDictEqual(
            response.json(),
            {
                "items": [
                    {"username": "test_user_1"},
                    {"username": "test_user_2"},
                ],
                "num_found": 2,
            },
        )

    def test_emulate_access(self):
        # Act
        response = self.client.post(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
            json={"actions": [ActionType.ReadDatatableAll.value]},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_stop_emulation_permitted(self):
        # Arange
        self.session.add(Role(name="Test Role"))
        self.session.flush()

        # Act
        response = self.client.delete(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
