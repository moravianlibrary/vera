from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.eligibility import EligibilityStatus
from definitions.proposal import ProposalStatus
from repositories.models.task import TaskAdditionModel, TaskModel
from repositories.proposal import ProposalRepository
from schemas.addition import IngestProposalsAdditionsTaskData
from schemas.proposal import IngestProposalsTaskData
from tasks.addition.ingest_base import IngestAdditionsTaskBase


class IngestProposalsTask(IngestAdditionsTaskBase):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session, indexer_session)
        self._proposal_repository = ProposalRepository(
            database_session, indexer_session
        )

    def init_task(self, task: TaskModel) -> None:
        data = IngestProposalsTaskData.model_validate(task.data)
        project = (
            self._project_repository.get_by_id(data.project_id)
            if data.project_id
            else None
        )

        for proposal in data.proposals:
            self._proposal_repository.create(
                proposal, data.batch_id, task.created_by, project
            )

        super().init_task(task)
