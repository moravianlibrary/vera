import time
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.task import TaskState
from repositories.models.task import TaskItemMixin, TaskModel
from repositories.task import TaskRepository

TaskItemModel = TypeVar("TaskItemModel", bound=TaskItemMixin)


class BaseTask(ABC):
    _progress_interval_seconds = 5

    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        self._task_repository = TaskRepository(
            database_session, indexer_session
        )

    def init_task(self, task_model: TaskModel) -> None:
        self._task_repository.update_state(task_model, TaskState.Planned)

    def run_task(self, task_model: TaskModel) -> None:
        try:
            self._start_task(task_model)
            self._perform_task(task_model)
            self._finish_task(task_model)
        except Exception as e:
            self._handle_error(task_model, e)

    def _start_task(self, task_model: TaskModel) -> None:
        self._task_repository.update_state(task_model, TaskState.Running)

    def _finish_task(self, task_model: TaskModel) -> None:
        self._task_repository.update_state(task_model, TaskState.Finished)

    def _handle_error(self, task_model: TaskModel, error: Exception) -> None:
        self._task_repository(task_model, TaskState.Failed, str(error))

    @abstractmethod
    def _perform_task(self, task_model: TaskModel) -> None:
        raise NotImplementedError("Subclasses must implement _perform_task().")


class BaseItemTask(BaseTask, Generic[TaskItemModel]):
    def _perform_task(self, task_model: TaskModel) -> None:
        last_save_time = time.monotonic()

        for task_item in task_model.items:
            try:
                self.process_task_item(task_item)
            except Exception as error:
                task_item.error_message = str(error)
            finally:
                task_item.processed = True

            now = time.monotonic()
            if now - last_save_time >= self._progress_interval_seconds:
                self._task_repository.save_and_index(task_model)
                last_save_time = now

        self._task_repository.save_and_index(task_model)

    @abstractmethod
    def _process_task_item(self, task_item: TaskItemModel) -> None:
        raise NotImplementedError(
            "Subclasses must implement _process_task_item()."
        )
