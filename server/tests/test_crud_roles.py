from tests.test_crud import TestCrudOperations

from security import crud
from security.schemas import RoleCreate
from security.types import ActionType


class TestRolesCrud(TestCrudOperations):
    def test_create(self):
        # Arrange
        role = RoleCreate(
            name="Test Role", actions=[ActionType.WriteDatatable]
        )

        # Act
        db_role = crud.create_role(role, self.db)

        # Assert
        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)

    def test_update_role(self):
        # Arrange
        role = RoleCreate(
            name="Test Role", actions=[ActionType.WriteDatatable]
        )
        newRole = RoleCreate(
            name="Updated Test Role", actions=[ActionType.Extract]
        )

        # Act
        db_role = crud.create_role(role, self.db)
        actions = [
            action.action
            for action in crud.get_role(db_role.id, self.db).role_actions
        ]
        db_newRole = crud.update_role(db_role.id, newRole, self.db)
        newActions = [
            action.action
            for action in crud.get_role(db_role.id, self.db).role_actions
        ]

        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_newRole.id, db_role.id)
        self.assertEqual(db_newRole.name, newRole.name)
        self.assertListEqual(actions, [ActionType.WriteDatatable])
        self.assertListEqual(newActions, [ActionType.Extract])

    def test_delete_role(self):
        # Arrange
        role = RoleCreate(
            name="Test Role", actions=[ActionType.WriteDatatable]
        )

        # Act
        db_role = crud.create_role(role, self.db)
        crud.delete_role(db_role.id, self.db)
        roles_after_delete = [role.id for role in crud.get_roles(self.db)]

        self.assertIsNotNone(db_role.id)
        self.assertEqual(db_role.name, role.name)
        self.assertNotIn(db_role.id, roles_after_delete)
