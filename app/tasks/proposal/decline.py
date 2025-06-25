from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.proposal import ProposalStatus
from repositories.models.task import TaskAdditionModel, TaskModel
from repositories.proposal import ProposalRepository
from tasks.base import BaseItemTask


# TODO: Use some reindex mixin
class IngestProposalsTask(BaseItemTask[TaskAdditionModel]):
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
        for proposal in self._proposal_repository.get_by_query(task.query):
            if proposal.status == ProposalStatus.Enqueued:
                proposal.status = ProposalStatus.Declined

        self._task_repository.save_and_index(task)

        super().init_task(task)
