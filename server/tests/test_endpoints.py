import unittest

from tests.helper_funcs import (
    createTestClient,
    mockClsEnv,
    cleanUpDependencyOverrides,
)


class TestEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.client = createTestClient()

    def tearDown(self) -> None:
        cleanUpDependencyOverrides()
