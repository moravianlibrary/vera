from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from repositories.models.task import TaskAdditionModel, TaskModel
from repositories.project import ProjectRepository
from schemas.addition import IngestProjectAdditionsTaskData

from .ingest_base import IngestAdditionsTaskBase


class IngestProjectAdditionsTask(IngestAdditionsTaskBase):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session, indexer_session)
        self._project_repository = ProjectRepository(
            database_session, indexer_session
        )

    def init_task(self, task: TaskModel) -> None:
        data = IngestProjectAdditionsTaskData(task.data)
        project = self._project_repository.get_by_id(data.project_id)

        for addition_create in data.additions:
            task.additions.append(
                TaskAdditionModel(
                    task=task,
                    addition=self._addition_repository.create(
                        addition_create,
                        data.batch_id,
                        task.created_by,
                        data.allow_new_iteration,
                        data.ignore_digitization_check,
                        project,
                    ),
                )
            )

        super().init_task(task)
