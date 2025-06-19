from definitions.task import TaskScope, TaskState
from repositories.addition import AdditionRepository
from repositories.catalog_record import CatalogRecordRepository
from repositories.category import CategoryRepository
from repositories.document import DocumentRepository
from repositories.models.task import TaskModel
from repositories.task import TaskRepository


class TaskWorkerService:
    def __init__(
        self,
        task_repository: TaskRepository,
        addition_repository: AdditionRepository,
        catalog_record_repository: CatalogRecordRepository,
        category_repository: CategoryRepository,
        document_repository: DocumentRepository,
    ):
        self._task_repository = task_repository
        self._addition_repository = addition_repository
        self._catalog_record_repository = catalog_record_repository
        self._category_repository = category_repository
        self._document_repository = document_repository

    def _enqueue_task_items(self, task: TaskModel):
        query = task.query

        if task.scope == TaskScope.Addition:
            self._addition_repository.enqueue_additions(
                task.id,
                [a.id for a in self._addition_repository.search_all(query)],
            )
        elif task.scope == TaskScope.CatalogRecord:
            self._catalog_record_repository.enqueue_catalog_records(
                task.id,
                [
                    c.id
                    for c in self._catalog_record_repository.search_all(query)
                ],
            )
        elif task.scope == TaskScope.Category:
            self._category_repository.enqueue_categories(
                task.id,
                [c.id for c in self._category_repository.search_all(query)],
            )
        elif task.scope == TaskScope.Document:
            self._document_repository.enqueue_documents(
                task.id,
                [d.id for d in self._document_repository.search_all(query)],
            )
        else:
            raise ValueError(f"Unsupported task scope: {task.scope}")

    def enqueue_task(self, task_id: int):
        task = self._task_repository.get_by_id(task_id)

        if task.task_state != TaskState.Initializing:
            raise ValueError(
                f"Task with ID {task_id} is not in the initializing state."
            )

        if task.query is not None:
            self._enqueue_task_items(task)

        task.task_state = TaskState.Planned

        self._task_repository.save(task)
        self._task_repository.index(task)
