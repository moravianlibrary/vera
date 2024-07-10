import unittest

from tests.helper_funcs import (
    createTestClient,
    mockClsEnv,
    cleanUpDependencyOverrides,
)

# from elasticmock import elasticmock


class TestIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    # @elasticmock
    def setUp(self):
        self.client = createTestClient()

    def tearDown(self) -> None:
        cleanUpDependencyOverrides()
