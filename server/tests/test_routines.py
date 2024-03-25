import unittest
from unittest.mock import MagicMock
from helper_funcs import mockClsEnv
from sqlalchemy.orm import Session


class TestRoutines(unittest.TestCase):
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
