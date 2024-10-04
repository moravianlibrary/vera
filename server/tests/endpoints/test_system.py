from .base import TestEndpointsBase
from models import Role
from textwrap import dedent


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
            dedent(
                """\
                id: 1
                name: Admin
                actions:
                - ReadDatatableOwn
                """
            ),
        )

    def test_role_from_yaml(self):
        # Arrange
        role_yaml = dedent(
            """\
            id: 1
            name: Admin
            actions:
            - ReadDatatableOwn
            """
        )
        # Act and Assert
        self.assertEqualModelData(
            Role.from_yaml(role_yaml),
            Role(id=1, name="Admin", _actions=["ReadDatatableOwn"]),
        )

    def test_roles_to_yaml(self):
        # Arrange
        self.session.add_all(
            [
                Role(name="Admin", _actions=["ReadDatatableOwn"]),
                Role(name="User", _actions=["ReadDatatableDepartment"]),
                Role(name="Guest", _actions=[]),
            ]
        )
        self.session.flush()

        # Act
        response = self.client.get(
            "/system/database/export?table=roles", headers=self.headers
        )
        # Assert
        self.assertResponse(response, 200)
        self.assertEqual(
            response.content.decode("utf-8"),
            dedent(
                """\
                roles:
                - id: 1
                  name: Admin
                  actions:
                  - ReadDatatableOwn
                - id: 3
                  name: Guest
                - id: 2
                  name: User
                  actions:
                  - ReadDatatableDepartment
                """
            ),
        )

    def test_import_roles_from_yaml(self):
        # Arrange
        return
        # TODO: implement
        file_data = dedent(
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
                """
        )

        # Act
        response = self.client.post(
            "/system/database/import",
            headers=self.headers,
            files={"file": ("roles.yaml", file_data, "application/x-yaml")},
        )

        # Assert
        self.assertResponse(response, 200)
        print(Role.all(self.session))
        for model in [
            Role(name="Admin", _actions=["ReadDatatableOwn"]),
            Role(name="User", _actions=["ReadDatatableDepartment"]),
            Role(name="Guest", _actions=[]),
        ]:
            self.assertEqualModelData(
                Role.find_by_name(self.session, model.name), model
            )
