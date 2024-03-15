import unittest

# from unittest.mock import patch
from helper_funcs import mockClsEnv


class TestCategoriesRoutines(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        from services.database import get_db

        self.db = next(get_db())

    def test_read_department_categories(self):
        pass
        # from categories. import
