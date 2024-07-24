from tests.test_crud import TestCrudOperations
from datatypes import ActionType
from models import Role, RoleAction


class TestRolesCrud(TestCrudOperations):
    def test_create(self):
        # Arrange
        role = Role(name="Test Role")
        actions = [ActionType.WriteDatatable]

        # Act
        db_role = role.save(self.db)
        db_role.save_actions(self.db, actions)

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
        db_role = role.save(self.db).save_actions(self.db, actions)
        actions = db_role.actions

        db_role.name = new_name
        db_role.save(self.db).save_actions(self.db, new_actions)
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
        db_role = role.save(self.db).save_actions(self.db, actions)
        role_id = db_role.id
        db_role.delete(self.db)
        roles_after_delete = [role.id for role in Role.all(self.db)]
        actions = self.db.query(RoleAction).filter_by(role_id=role_id).all()

        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)
        self.assertNotIn(db_role.id, roles_after_delete)
        self.assertEqual(actions, [])
