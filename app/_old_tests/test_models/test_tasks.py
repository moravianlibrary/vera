from .base import TestModelBase
from models import Task, TaskItem, TaskDataset
from datatypes import TaskType, TaskItemErrorType, TaskItemType


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestTaskModelPropertiesParsing(TestModelBase):
    def set_up_task_documents_testing(self):
        self.session.add(
            Task(
                task_type=TaskType.ReindexDocuments,
                owner="Test User",
            )
        )
        self.session.flush()
        self.session.add_all(
            [
                TaskItem(
                    task_id=1,
                    item_id="1",
                    item_type=TaskItemType.Document,
                    processed=True,
                ),
                TaskItem(
                    task_id=1,
                    item_id="2",
                    item_type=TaskItemType.Document,
                    processed=False,
                ),
                TaskItem(
                    task_id=1,
                    item_id="3",
                    item_type=TaskItemType.Document,
                    processed=True,
                    error_type=TaskItemErrorType.UnknownError,
                ),
                TaskItem(
                    task_id=1,
                    item_id="4",
                    item_type=TaskItemType.Document,
                    processed=False,
                    error_type=TaskItemErrorType.UnknownError,
                ),
            ]
        )
        self.session.flush()

    def test_processed_count_parsing(self):
        # Arrange
        self.set_up_task_documents_testing()
        # Act and Assert
        self.assertEqual(Task.get(self.session, 1).processed_count, 2)

    def test_total_count_parsing(self):
        # Arrange
        self.set_up_task_documents_testing()
        # Act and Assert
        self.assertEqual(Task.get(self.session, 1).total_count, 4)

    def test_error_count_parsing(self):
        # Arrange
        self.set_up_task_documents_testing()
        # Act and Assert
        self.assertEqual(Task.get(self.session, 1).error_count, 2)

    def test_has_dataset_parsing_false(self):
        # Arrange
        self.session.add(
            Task(
                task_type=TaskType.ReindexDocuments,
                owner="Test User",
            )
        )
        # Act and Assert
        self.assertFalse(Task.get(self.session, 1).has_dataset)

    def set_up_task_datasets_testing(self):
        self.session.add_all(
            [
                Task(
                    task_type=TaskType.GenerateItemsPagesDataset,
                    owner="Test User",
                ),
                TaskDataset(
                    task_id=1,
                    data={"sysno": "MZK01-000165329"},
                    error_message="Failed to predict page count",
                ),
            ]
        )

    def test_has_dataset_parsing_true(self):
        # Arrange
        self.set_up_task_datasets_testing()
        # Act and Assert
        self.assertTrue(Task.get(self.session, 1).has_dataset)

    def test_dataset_error_parsing(self):
        # Arrange
        self.set_up_task_datasets_testing()
        # Act and Assert
        self.assertEqual(
            Task.get(self.session, 1).dataset_error,
            "Failed to predict page count",
        )
