import unittest
from unittest.mock import MagicMock
from helper_funcs import mockClsEnv
from sqlalchemy.orm import Session

from departments import crud, schemas


class TestDepartmentsCrudOperations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.db: MagicMock = MagicMock(spec=Session)

    def tearDown(self):
        self.db.close()

    def test_create_department(self):
        # Arrange
        department_data = schemas.DepartmentBase(
            name="Test Department",
            abbreviation="ABC",
            users=["Test User 1", "Test User 2"],
        )

        # Act
        db_department = crud.create_department(department_data, self.db)

        # Assert
        self.db.add.assert_called_once()
        # self.assertEqual(db_department.id, 1)
        self.assertEqual(
            db_department.abbreviation, department_data.abbreviation
        )
        self.assertEqual(db_department.name, department_data.name)
        self.assertEqual(db_department.users, department_data.users)
