from .base import TestEndpointsBase
from models import Department, User


class TestDepartmentsEndpoints(TestEndpointsBase):
    def mockTestDepartment(self):
        self.session.add(
            Department(
                id=1,
                name="Test Department",
                abbreviation="TST",
            )
        )
        self.session.flush()

    def test_create_department(self):
        # Arrange
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "usernames": ["Test User 1", "Test User 2"],
        }

        # Act
        response = self.client.post(
            "/departments", json=department_json, headers=self.json_headers
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            User.get(self.session, "Test User 1").department_id, 1
        )
        self.assertEqual(
            User.get(self.session, "Test User 2").department_id, 1
        )

    def test_update_department(self):
        # Arrange
        self.mockTestDepartment()
        department_update = {
            "name": "Updated Department Name",
            "abbreviation": "UDN",
        }

        # Act
        response = self.client.put(
            "/departments/1", json=department_update, headers=self.json_headers
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        body = response.json()
        self.assertEqual(body["name"], department_update["name"])
        self.assertEqual(
            body["abbreviation"], department_update["abbreviation"]
        )

        department = Department.get(self.session, 1)
        self.assertEqual(department.name, department_update["name"])
        self.assertEqual(
            department.abbreviation, department_update["abbreviation"]
        )

    def test_update_department_removing_usernames(self):
        # Arrange
        self.mockTestDepartment()
        self.session.add(User(username="Test User", department_id=1))
        self.session.flush()
        department_json = {
            "name": "Test Department",
            "abbreviation": "TST",
        }

        # Act
        response = self.client.put(
            "/departments/1", json=department_json, headers=self.json_headers
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertIsNone(User.get(self.session, "Test User").department_id)

    def test_delete_role(self):
        # Arrange
        self.mockTestDepartment()
        # Act
        response = self.client.delete(
            "/departments/1", headers=self.json_headers
        )
        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(Department.find(self.session, 1))

    def test_get_roles(self):
        # Arrange
        self.session.add_all(
            [
                Department(
                    id=1,
                    name="Test Department 1",
                    abbreviation="TST-1",
                ),
                Department(
                    id=2,
                    name="Test Department 2",
                    abbreviation="TST-2",
                ),
                Department(
                    id=3,
                    name="Test Department 3",
                    abbreviation="TST-3",
                ),
            ]
        )
        self.session.flush()
        self.session.add_all(
            [
                User(username="Test User 1", department_id=2),
                User(username="Test User 2", department_id=3),
                User(username="Test User 3", department_id=3),
            ]
        )
        self.session.flush()

        expected_departments = [
            {
                "id": 1,
                "name": "Test Department 1",
                "abbreviation": "TST-1",
                "usernames": [],
            },
            {
                "id": 2,
                "name": "Test Department 2",
                "abbreviation": "TST-2",
                "usernames": ["Test User 1"],
            },
            {
                "id": 3,
                "name": "Test Department 3",
                "abbreviation": "TST-3",
                "usernames": ["Test User 2", "Test User 3"],
            },
        ]

        # Act
        response = self.client.get("/departments", headers=self.headers)

        # Assert
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(expected_departments), len(body))
        for expected_department, actual_department in zip(
            expected_departments, body
        ):
            self.assertEqual(
                expected_department["id"], actual_department["id"]
            )
            self.assertEqual(
                expected_department["name"], actual_department["name"]
            )
            self.assertEqual(
                expected_department["abbreviation"],
                actual_department["abbreviation"],
            )
            self.assertListEqual(
                expected_department["usernames"],
                actual_department["usernames"],
            )
