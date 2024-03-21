import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData

from services.database import Base

from auth.models import User  # noqa: F401
from categories.models import Category, CategoryDepartments  # noqa: F401
from categories.quotas.models import Quota  # noqa: F401
from departments.models import Department  # noqa: F401
from documents.models import Document  # noqa: F401
from documents.comments.models import Comment  # noqa: F401
from extractions.models import Extraction  # noqa: F401
from roles.models import Role  # noqa: F401
from tasks.models import Task, TaskDocument  # noqa: F401

# import logging

# logging.basicConfig()
# logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

test_engine = create_engine(
    "postgresql://veraAdmin:password@localhost:5433/vera-test",
)
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine
)


class TestCrudOperations(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(test_engine)
        self.db = TestSessionLocal()

    def tearDown(self) -> None:
        self.db.reset()
        meta = MetaData()
        meta.reflect(bind=test_engine)
        meta.drop_all(bind=test_engine)
        return self.db.close()
