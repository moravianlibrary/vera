from .base import TestModelBase
from datatypes import ActionType
from models.roles import Role, RoleAction


class TestRolesModel(TestModelBase):
    def test_create(self):
        # Arrange
        role = Role(name="Test Role")
        actions = [ActionType.WriteDatatable]

        # Act
        db_role = role.save(self.session)
        db_role.save_actions(self.session, actions)

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)

    def test_update_role(self):
        # Arrange
        role = Role(
            name="Test Role",
        )
        actions = [ActionType.WriteDatatable]
        new_name = "Updated Test Role"
        new_actions = [ActionType.Extract]

        # Act
        db_role = role.save(self.session).save_actions(self.session, actions)
        actions = db_role.actions

        db_role.name = new_name
        db_role.save(self.session).save_actions(self.session, new_actions)
        new_actions = db_role.actions

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, new_name)
        self.assertListEqual(actions, [ActionType.WriteDatatable])
        self.assertListEqual(new_actions, [ActionType.Extract])

    def test_delete_role(self):
        # Arrange
        role = Role(name="Test Role")
        actions = [ActionType.WriteDatatable]

        # Act
        db_role = role.save(self.session).save_actions(self.session, actions)
        role_id = db_role.id
        db_role.delete(self.session)
        roles_after_delete = [role.id for role in Role.all(self.session)]
        actions = (
            self.session.query(RoleAction).filter_by(role_id=role_id).all()
        )

        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)
        self.assertNotIn(db_role.id, roles_after_delete)
        self.assertEqual(actions, [])

    def test_find_by_name(self):
        # Arrange
        role = Role(name="Test Role")
        actions = [ActionType.WriteDatatable]

        # Act
        db_role = role.save(self.session).save_actions(self.session, actions)
        found_role = Role.find_by_name(self.session, role.name)

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, found_role.name)
