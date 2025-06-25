from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.addition import AdditionStatus
from repositories.models.task import TaskAdditionModel, TaskModel
from schemas.addition import ReIngestAdditionsTaskBaseData

from .ingest_base import IngestAdditionsTaskBase


class AdditionReingestTask(IngestAdditionsTaskBase):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session, indexer_session)

    def init_task(self, task: TaskModel) -> None:
        data = ReIngestAdditionsTaskBaseData.model_validate(task.data)

        for addition in self._addition_repository.get_by_query(task.query):
            if addition.status != AdditionStatus.NotEligibleForAddition:
                continue
            if data.allow_new_iteration and addition.allow_new_iteration:
                continue
            if (
                data.ignore_digitization_check
                and addition.ignore_digitization_check
            ):
                continue

            addition.status = AdditionStatus.Enqueued
            addition.eligibility_status = None
            addition.allow_new_iteration = data.allow_new_iteration
            addition.ignore_digitization_check = data.ignore_digitization_check

            task.additions.append(
                TaskAdditionModel(task=task, addition=addition)
            )

        super().init_task(task)
