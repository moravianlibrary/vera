import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData

from services.database import Base

from models import (  # noqa: F401
    CatalogRecord,
    CatalogRecordBarcode,
    Extraction,
    Document,
    DocumentComment,
    Department,
    User,
    Role,
    RoleAction,
    Task,
    TaskDocument,
    Category,
    CategoryDepartments,
    Distribution,
    Intention,
    DigitizationList,
    Location,
)


# import logging

# logging.basicConfig()
# logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

# test_engine = create_engine(
#     "postgresql://veraAdmin:password@localhost:5433/vera-test",
# )
test_engine = create_engine("sqlite:///:memory:")
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine
)


class TestCrudOperations(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(test_engine)
        self.db = TestSessionLocal()

    def tearDown(self) -> None:
        meta = MetaData()
        meta.reflect(bind=test_engine)
        meta.drop_all(bind=test_engine)
        return self.db.close()
