from ..base import TestEndpointsBase
from datatypes import ActionType


class TestUsersEndpointsPermissions(TestEndpointsBase):
    def tearDown(self) -> None:
        from routers.utils.access_emulation import emulated_users

        super().tearDown()
        emulated_users.clear()

    def test_get_users_permitted(self):
        # Arange
        self.mockTestUser([ActionType.EditAccess])
        # Act
        response = self.client.get("/users", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 200)

    def test_get_users_prohibited(self):
        # Arange
        self.mockTestAntiUser([ActionType.EditAccess])
        # Act
        response = self.client.get("/users", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 403)

    def test_emulate_access_permitted(self):
        # Arange
        self.mockTestUser([ActionType.EditAccess])
        # Act
        response = self.client.post(
            "/users/current/emulate", headers=self.headers
        )
        # Assert
        self.assertEqual(response.status_code, 422)

    def test_emulate_access_prohibited(self):
        # Arange
        self.mockTestAntiUser([ActionType.EditAccess])
        # Act
        response = self.client.post(
            "/users/current/emulate", headers=self.headers
        )
        # Assert
        self.assertEqual(response.status_code, 403)

    def test_stop_emulation_permitted(self):
        # Arange
        self.mockTestUser([ActionType.EditAccess])
        # Act
        response = self.client.delete(
            "/users/current/emulate", headers=self.headers
        )
        # Assert
        self.assertEqual(response.status_code, 404)

    def test_stop_access_emulation_prohibited(self):
        # Arange
        self.mockTestAntiUser(
            [ActionType.EditAccess, ActionType.EmulateAccess]
        )
        # Act
        response = self.client.delete(
            "/users/current/emulate", headers=self.headers
        )
        # Assert
        self.assertEqual(response.status_code, 403)
