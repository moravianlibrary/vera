from .base import TestModelBase
from models import Department, User


class TestDepartmentsModel(TestModelBase):
    def test_usernames_parsing(self):
        # Arrange
        self.session.add_all(
            [
                Department(id=1, abbreviation="TST", name="test_department"),
                User(username="test_user_1", department_id=1),
                User(username="test_user_2", department_id=1),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Department.get(self.session, 1).usernames,
            ["test_user_1", "test_user_2"],
        )

    def test_save_successfully_adding_users_to_department(self):
        # Arrange
        self.session.add_all(
            [
                Department(id=1, abbreviation="TST", name="test_department"),
                User(username="test_user_1"),
            ]
        )
        # Act
        Department.get(self.session, 1).save_users(
            self.session, ["test_user_1", "test_user_2"]
        )
        # Assert
        self.assertEqual(
            Department.get(self.session, 1).usernames,
            ["test_user_1", "test_user_2"],
        )
        self.assertEqual(
            User.get(self.session, "test_user_1").department_id, 1
        )
        self.assertEqual(
            User.get(self.session, "test_user_2").department_id, 1
        )

    def test_save_successfully_removing_and_adding_users_from_department(self):
        # Arrange
        self.session.add_all(
            [
                Department(id=1, abbreviation="TST", name="test_department"),
                User(username="test_user_1", department_id=1),
                User(username="test_user_2", department_id=1),
            ]
        )
        # Act
        Department.get(self.session, 1).save_users(
            self.session, ["test_user_2", "test_user_3"]
        )
        # Assert
        self.assertEqual(
            Department.get(self.session, 1).usernames,
            ["test_user_2", "test_user_3"],
        )
        self.assertIsNone(User.get(self.session, "test_user_1").department_id)
        self.assertEqual(
            User.get(self.session, "test_user_2").department_id, 1
        )
        self.assertEqual(
            User.get(self.session, "test_user_3").department_id, 1
        )
