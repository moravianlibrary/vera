import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData

from services.database import Base

from models.catalog_records import (  # noqa: F401
    CatalogRecord,
    CatalogRecordBarcode,
)  # noqa: F401
from models.documents import Document  # noqa: F401
from models.security import Department, User, Role  # noqa: F401
from models.tasks import Task, TaskDocument  # noqa: F401

from categories.categories.models import (  # noqa: F401
    Category,
    CategoryDepartments,
    Distribution,
)  # noqa: F401
from categories.intentions.models import Intention  # noqa: F401
from documents.comments.models import Comment  # noqa: F401
from extractions.generated.models import GeneratedExtraction  # noqa: F401
from extractions.digitization.models import (  # noqa: F401
    DigitizationExtraction,
)  # noqa: F401
from extractions.locations.models import Location  # noqa: F401

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
        self.db.reset()
        meta = MetaData()
        meta.reflect(bind=test_engine)
        meta.drop_all(bind=test_engine)
        return self.db.close()
