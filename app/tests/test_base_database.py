from unittest import TestCase
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from vera import app
from models.base_engine import Base, get_session


test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=True, bind=test_engine
)


class TestBaseDatabase(TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(test_engine)

    def setUp(self):
        self.connection = test_engine.connect()
        self.transaction = self.connection.begin()
        self.session = TestSessionLocal(bind=self.connection)
        self.session.execute(text("PRAGMA foreign_keys=ON;"))

        app.dependency_overrides[get_session] = lambda: TestSessionLocal(
            bind=self.connection
        )

    def tearDown(self):
        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(test_engine)
