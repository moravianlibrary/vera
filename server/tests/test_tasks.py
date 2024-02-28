import unittest
from helper_funcs import setUpEnv


class TestRolesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from services.database import get_db

        self.test_sysno = "MZK01-000165329"
        self.test_volume = "39"
        self.test_barcode = "2619868037"
        self.test_title = "Test Document"

        self.db = next(get_db())

    def test_task_by_id(self):
        from celery_worker import run_task

        task_id = 57
        run_task(task_id)

    def create_test_document(self):
        from documents.crud import create_document, document_exists
        from documents.schemas import DocumentCreate

        if document_exists(
            self.test_sysno, self.test_volume, self.test_barcode, self.db
        ):
            self.delete_test_document()

        self.document_id = create_document(
            DocumentCreate(
                sysno=self.test_sysno,
                volume=self.test_volume,
                barcode=self.test_barcode,
                title=self.test_title,
            ),
            "test_user",
            self.db,
        ).id

    def delete_test_document(self):
        from documents.crud import get_document_by_identifiers, delete_document
        from tasks.models import TaskDocument

        document = get_document_by_identifiers(
            self.test_sysno, self.test_volume, self.test_barcode, self.db
        )
        if document is not None:
            db_task_documents = (
                self.db.query(TaskDocument)
                .where(TaskDocument.document_id == document.id)
                .all()
            )
            for db_task_document in db_task_documents:
                self.db.delete(db_task_document)
            self.db.commit()
            delete_document(document.id, self.db)

    def test_catalog_sync(self):
        from documents.crud import get_document
        from tasks.crud import create_task, delete_task
        from tasks.enums import TaskType
        from tasks.routines import sync_from_catalog
        from tasks.schemas import TaskCreate

        self.create_test_document()

        task = create_task(
            TaskCreate(task_type=TaskType.SyncFromCatalog),
            [self.document_id],
            "test_user",
            f"id={self.document_id}",
            self.db,
        )

        document = get_document(self.document_id, self.db)
        self.assertEqual(document.title, self.test_title)
        self.assertEqual(document.digitization_state, None)

        sync_from_catalog(task.id, "test_user", self.db)

        document = get_document(self.document_id, self.db)
        self.assertEqual(
            document.title, "Lidé a země : zeměpisný a cestopisný měsíčník"
        )
        self.assertEqual(document.digitization_state, None)

        delete_task(task.id, self.db)
        self.delete_test_document()

    def test_registry_sync(self):
        from catalogs.enums import DigitizationState
        from documents.crud import get_document
        from tasks.crud import create_task, delete_task
        from tasks.enums import TaskType
        from tasks.routines import sync_from_digitization_registry
        from tasks.schemas import TaskCreate

        self.create_test_document()

        task = create_task(
            TaskCreate(task_type=TaskType.SyncFromCatalog),
            [self.document_id],
            "test_user",
            f"id={self.document_id}",
            self.db,
        )

        document = get_document(self.document_id, self.db)
        self.assertEqual(document.title, self.test_title)
        self.assertEqual(document.digitization_state, None)

        sync_from_digitization_registry(task.id, "test_user", self.db)

        document = get_document(self.document_id, self.db)
        self.assertEqual(document.title, self.test_title)
        self.assertEqual(
            document.digitization_state, DigitizationState.Finished
        )

        delete_task(task.id, self.db)
        self.delete_test_document()
