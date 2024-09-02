from .base import TestModelBase
from models import User


class TestUserModelOperations(TestModelBase):
    def test_find(self):
        # Arrange
        self.session.add_all(
            [
                User(username="test_user_1"),
                User(username="test_user_2"),
                User(username="test_user_3"),
            ]
        )
        # Act and Assert
        self.assertEqual(
            User.find(self.session, "test_user_1").username, "test_user_1"
        )

    def test_save_when_user_does_not_exist(self):
        # Arrange
        user = User(username="test_user")
        # Act
        user.save(self.session)
        # Assert
        db_user = User.find(self.session, "test_user")
        self.assertEqual(db_user.username, "test_user")

    def test_save_when_user_does_exist(self):
        # Arrange
        self.session.add(User(username="test_user"))

        # Act
        user = User.find(self.session, "test_user")
        user.settings = {"key": "value"}
        user.save(self.session)

        # Assert
        db_user = User.find(self.session, "test_user")
        self.assertEqual(db_user.username, "test_user")
        self.assertEqual(db_user.settings, {"key": "value"})
