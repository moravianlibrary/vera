# TODO: fix tests

# from tests.test_integration import TestIntegration
# from helper_funcs import mock_db, get_test_db
# from crud.documents import create_document, get_document
# from schemas.documents import DocumentCreate
# from tasks.crud import create_query_task
# from tasks.types import TaskType
# from tasks.schemas import TaskCreate
# from tasks.tasks.sync_from_catalog import sync_from_catalog
# from tasks.tasks.sync_from_digitization_registry import (
#     sync_from_digitization_registry,
# )
# from services.external.digitization_registry.types import DigitizationState


# class TestCatalogSync(TestIntegration):
#     def test_catalog_sync(self):
#         # Arrange
#         document = DocumentCreate(
#             sysno="MZK01-000165329",
#             volume="39",
#             barcode="2619868037",
#             title="Test Document",
#         )
#         task = TaskCreate(task_type=TaskType.SyncFromCatalog)
#         mock_db()

#         # Act
#         session = get_test_db()
#         document_id = create_document(document, "Test User", session).id
#         document_before_sync = get_document(document_id, session)
#         title_before_sync = document_before_sync.title
#         state_before_sync = document_before_sync.digitization_state
#         task_id = create_query_task(
#             task.task_type,
#             [document_id],
#             "Test User",
#             f"id={document_id}",
#             session,
#         ).id
#         sync_from_catalog(task_id, "Test User", session)
#         document_after_sync = get_document(document_id, session)
#         session.close()

#         # Assert
#         self.assertEqual(title_before_sync, "Test Document")
#         self.assertEqual(state_before_sync, None)
#         self.assertEqual(
#             document_after_sync.title,
#             "Lidé a země : zeměpisný a cestopisný měsíčník",
#         )
#         self.assertEqual(document_after_sync.digitization_state, None)

#     def test_registry_sync(self):
#         # Arrange
#         document = DocumentCreate(
#             sysno="MZK01-000165329",
#             volume="39",
#             barcode="2619868037",
#             title="Test Document",
#             digitization_state=DigitizationState.InProgress,
#         )
#         task = TaskCreate(task_type=TaskType.SyncFromDigitizationRegistry)
#         mock_db()

#         # Act
#         session = get_test_db()
#         document_id = create_document(document, "Test User", session).id
#         state_before_sync = get_document(
#             document_id, session
#         ).digitization_state
#         task_id = create_query_task(
#             task.task_type,
#             [document_id],
#             "Test User",
#             f"id={document_id}",
#             session,
#         ).id
#         sync_from_digitization_registry(task_id, "Test User", session)
#         document_after_sync = get_document(document_id, session)
#         session.close()

#         # Assert
#         self.assertEqual(state_before_sync, document.digitization_state)
#         self.assertEqual(
#             document_after_sync.digitization_state, DigitizationState.Finished
#         )
