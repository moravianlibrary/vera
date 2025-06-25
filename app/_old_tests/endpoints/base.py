from _old_tests.test_base_client import TestBaseClient
from _old_tests.test_base_database import TestBaseDatabase
from _old_tests.test_base_mocker import TestBaseMocker
from _old_tests.test_mock_indexer import TestMockIndexer
from _old_tests.test_mock_user import TestMockUser


class TestEndpointsBase(
    TestBaseDatabase,
    TestBaseClient,
    TestBaseMocker,
    TestMockIndexer,
    TestMockUser,
):
    def setUp(self):
        TestBaseDatabase.setUp(self)
        TestBaseClient.setUp(self)
        TestBaseMocker.setUp(self)
        TestMockIndexer.setUp(self)
        TestMockUser.setUp(self)
        self.mockTestSuperUser()
