from tests.test_integration import TestIntegration
from tests.helper_funcs import (
    createTestUser,
    get_all_actions_except,
    mockUser,
    mock_db,
)

from datatypes import ActionType
from models import Role, User


class TestUsersEndpointsPermissions(TestIntegration):
    def tearDown(self) -> None:
        from routers.utils.access_emulation import emulated_users

        super().tearDown()
        emulated_users.clear()

    def test_get_users_permitted(self):
        # Arange
        mock_db()
        mockUser(createTestUser(actions=[ActionType.EditAccess]))

        # Act
        response = self.client.get(
            "/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_get_users_prohibited(self):
        # Arange
        mock_db()
        mockUser(
            createTestUser(get_all_actions_except([ActionType.EditAccess]))
        )

        # Act
        response = self.client.get(
            "/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_emulate_access_permitted(self):
        # Arange
        mock_db()
        mockUser(createTestUser(actions=[ActionType.EditAccess]))

        # Act
        response = self.client.post(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
            json={"actions": [ActionType.ReadDatatableAll.value]},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_emulate_access_prohibited(self):
        # Arange
        mock_db()
        mockUser(
            createTestUser(get_all_actions_except([ActionType.EditAccess]))
        )

        # Act
        response = self.client.post(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
            json={"actions": [ActionType.ReadDatatableAll.value]},
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_stop_emulation_permitted(self):
        # Arange
        mock_db([Role(name="Test Role")])
        mockUser(createTestUser(actions=[ActionType.EditAccess]))

        # Act
        response = self.client.delete(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_stop_access_emulation_prohibited(self):
        # Arange
        mock_db()
        mockUser(
            createTestUser(
                get_all_actions_except(
                    [ActionType.EditAccess, ActionType.EmulateAccess]
                )
            )
        )

        # Act
        response = self.client.delete(
            "/users/current/emulate",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)


class TestUsersEndpoints(TestIntegration):
    def test_get_current_user(self):
        # Arange
        mock_db()
        test_user = createTestUser(
            settings={"personalization": {"key": "value"}}
        )
        mockUser(test_user)

        # Act
        response = self.client.get(
            "/users/current",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], test_user.username)
        self.assertEqual(
            response.json()["settings"], {"personalization": {"key": "value"}}
        )

    def test_set_current_user_settings(self):
        # Arange
        test_user = createTestUser()
        mock_db([User(username=test_user.username)])
        mockUser(test_user)

        # Act
        response = self.client.post(
            "/users/current/settings",
            headers={"Authorization": "Bearer test_token"},
            json={"personalization": {"key": "value"}},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], test_user.username)
        self.assertEqual(
            response.json()["settings"], {"personalization": {"key": "value"}}
        )
