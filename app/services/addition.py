from pymarc import List

from adapters.indexer import IndexerQuery
from definitions.task import AdditionTask, TaskScope
from repositories import AdditionRepository
from schemas.addition import AdditionCreate
from schemas.task import Task
from services import TaskService


class AdditionService:
    def __init__(
        self,
        addition_repository: AdditionRepository,
        task_service: TaskService,
    ):
        self._addition_repository = addition_repository
        self._task_service = task_service

    def ingest(self, additions: List[AdditionCreate], created_by: str) -> Task:
        return self._task_service.init_task_with_data(
            TaskScope.Addition,
            AdditionTask.Ingest,
            f"Ingest {len(additions)} addition(s) by {created_by} "
            f"in batch {additions[0].batch_name}",
            created_by,
            additions,
        )

    def ignore_digitization_check(
        self, query: IndexerQuery, created_by: str
    ) -> Task:
        return self._task_service.init_query_task(
            TaskScope.Addition,
            AdditionTask.IgnoreDigitizationCheck,
            f"Ignore digitization check for additions by {created_by}",
            created_by,
            query,
        )

    def allow_new_iteration(
        self, query: IndexerQuery, created_by: str
    ) -> Task:
        return self._task_service.init_query_task(
            TaskScope.Addition,
            AdditionTask.AllowNewIteration,
            f"Allow new iteration for additions by {created_by}",
            created_by,
            query,
        )

    def archive(self, query: IndexerQuery, created_by: str) -> Task:
        return self._task_service.init_query_task(
            TaskScope.Addition,
            AdditionTask.Archive,
            f"Archive additions by {created_by}",
            created_by,
            query,
        )

    def delete(self, query: IndexerQuery, created_by: str) -> Task:
        return self._task_service.init_query_task(
            TaskScope.Addition,
            AdditionTask.Delete,
            f"Delete additions by {created_by}",
            created_by,
            query,
        )
