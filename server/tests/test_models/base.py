import unittest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from services.database import Base

test_engine = create_engine("sqlite:///:memory:")
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=True, bind=test_engine
)


class TestModelBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(test_engine)

    def setUp(self):
        self.connection = test_engine.connect()
        self.transaction = self.connection.begin()
        self.session = TestSessionLocal(bind=self.connection)
        self.session.execute(text("PRAGMA foreign_keys=ON;"))

    def tearDown(self):
        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(test_engine)
