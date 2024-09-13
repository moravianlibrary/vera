from .base import TestEndpointsBase
from models import Role


class TestSystemEndpoints(TestEndpointsBase):
    def assertEqualModelData(self, actual, expected):
        for column in actual.__table__.columns:
            name = column.name
            if name in ["id", "created_at", "updated_at"]:
                continue
            self.assertEqual(getattr(actual, name), getattr(expected, name))

    def test_role_to_yaml(self):
        # Arrange
        role = Role(id=1, name="Admin", _actions=["ReadDatatableOwn"])
        # Act and Assert
        self.assertEqual(
            role.to_yaml(),
            """\
id: 1
name: Admin
actions:
- ReadDatatableOwn
""",
        )

    def test_role_from_yaml(self):
        # Arrange
        role_yaml = """\
id: 1
name: Admin
actions:
- ReadDatatableOwn
"""
        # Act
        # Assert
        self.assertEqualModelData(
            Role.from_yaml(role_yaml),
            Role(id=1, name="Admin", _actions=["ReadDatatableOwn"]),
        )

    def test_roles_to_yaml(self):
        # Arrange
        self.session.add_all(
            [
                Role(id=1, name="Admin", _actions=["ReadDatatableOwn"]),
                Role(id=2, name="User", _actions=["ReadDatatableDepartment"]),
                Role(id=3, name="Guest", _actions=[]),
            ]
        )
        self.session.flush()

        # Act and Assert
        self.assertEqual(
            Role.export_to_yaml(self.session),
            """\
roles:
- id: 1
  name: Admin
  actions:
  - ReadDatatableOwn
- id: 2
  name: User
  actions:
  - ReadDatatableDepartment
- id: 3
  name: Guest
""",
        )
