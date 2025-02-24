from .base import TestModelBase
from datatypes import ActionType
from models.roles import Role


class TestRolesModel(TestModelBase):
    def test_create(self):
        # Arrange
        role = Role(name="Test Role", actions=[ActionType.WriteDatatable])

        # Act
        db_role = role.save(self.session)
        # db_role.save_actions(self.session, actions)

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)

    def test_update_role(self):
        # Arrange
        self.session.add(
            Role(name="Test Role", actions=[ActionType.WriteDatatable])
        )
        new_name = "Updated Test Role"
        new_actions = [ActionType.Extract]

        # Act
        db_role = Role.find_by_name(self.session, "Test Role")
        db_role.name = new_name
        db_role.actions = new_actions
        db_role.save(self.session)

        # Assert
        db_role = Role.find_by_name(self.session, "Updated Test Role")
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, new_name)
        self.assertListEqual(db_role.actions, [ActionType.Extract])

    def test_delete_role(self):
        # Arrange
        role = Role(name="Test Role", actions=[ActionType.WriteDatatable])

        # Act
        db_role = role.save(self.session)
        db_role.delete(self.session)
        roles_after_delete = [role.id for role in Role.all(self.session)]

        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)
        self.assertNotIn(db_role.id, roles_after_delete)

    def test_find_by_name(self):
        # Arrange
        role = Role(name="Test Role", actions=[ActionType.WriteDatatable])

        # Act
        db_role = role.save(self.session)
        found_role = Role.find_by_name(self.session, role.name)

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, found_role.name)
