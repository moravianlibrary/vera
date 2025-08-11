from adapters.database import DatabaseSession
from adapters.digitization_registry import DigitizationRegistryAdapter
from adapters.indexer import IndexerSession
from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from repositories.addition import AdditionRepository
from repositories.catalog_record import CatalogRecordRepository
from repositories.document import DocumentRepository
from repositories.models.task import TaskAdditionModel, TaskModel
from services.catalog_adapter import CatalogSearchService
from tasks.base import BaseItemTask
from tasks.mixins.eligibility_check import EligibilityCheckMixin


class IngestAdditionsTaskBase(
    BaseItemTask[TaskAdditionModel], EligibilityCheckMixin
):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session, indexer_session)
        self._addition_repository = AdditionRepository(
            database_session, indexer_session
        )
        # TODO: Initialize in some nice way
        self._catalog_search_service = CatalogSearchService()
        self._catalog_record_repository = CatalogRecordRepository(
            database_session, indexer_session
        )
        self._digitization_registry = DigitizationRegistryAdapter()
        self._document_repository = DocumentRepository(
            database_session, indexer_session
        )

    def init_task(self, task: TaskModel) -> None:
        self._task_repository.save_and_index(task)

        super().init_task(task)

    def _process_task_item(self, task_item: TaskAdditionModel) -> None:
        addition = task_item.addition

        result = self._check_eligibility(
            addition.identifier_type,
            addition.identifier_value,
            addition.allow_new_iteration,
            addition.ignore_digitization_check,
        )

        if result.eligibility != EligibilityStatus.Eligible:
            self._addition_repository.change_status(
                addition,
                AdditionStatus.NotEligibleForAddition,
                result.eligibility,
            )
            if result.error:
                raise result.error
            return

        document_model = (
            result.document_model
            if result.document_model is not None
            else self._document_repository.create(
                result.candidate_records[0].id,
                result.marc_issue,
                result.digitization_record,
            )
        )

        self._document_repository.create_document_iteration(
            document_model,
            task_item.task.created_by,
        )
