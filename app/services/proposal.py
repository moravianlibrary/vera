from adapters.indexer import IndexerQuery
from definitions.task import ProposalTask, TaskScope
from repositories.models.task import TaskModel
from repositories.proposal import ProposalBatchRepository, ProposalRepository
from repositories.task import TaskRepository
from schemas.common import BatchParams
from schemas.proposal import (
    ApproveProposalsParams,
    ApproveProposalsTaskData,
    IngestProposalsResponse,
    IngestProposalsTaskData,
    ProposalCreate,
    RejectProposalsParams,
)

from .task import TaskBasedService

TASK_NAMES_MAPPING = {
    ProposalTask.Ingest: "Ingest proposals",
    ProposalTask.Reingest: "Reingest proposals",
    ProposalTask.Approve: "Approve proposals",
    ProposalTask.Reject: "Reject proposals",
    ProposalTask.Delete: "Delete proposals",
}


class ProposalService(TaskBasedService):
    _task_scope = TaskScope.Proposal
    _task_names_mapping = TASK_NAMES_MAPPING

    def __init__(
        self,
        proposal_repository: ProposalRepository,
        batch_repository: ProposalBatchRepository,
        task_repository: TaskRepository,
    ):
        super().__init__(task_repository)
        self._proposal_repository = proposal_repository
        self._batch_repository = batch_repository

    async def ingest(
        self,
        proposals: ProposalCreate,
        batch_params: BatchParams,
        created_by: str,
    ) -> TaskModel:
        batch = self._batch_repository.get_or_create(batch_params, created_by)

        task = await self._create_task(
            ProposalTask.Ingest,
            created_by,
            data=IngestProposalsTaskData(
                batch_id=batch.id, proposals=proposals
            ),
        )

        return IngestProposalsResponse(
            task=self._serialize_task(task), batch_id=batch.id
        )

    async def reingest(
        self,
        query: IndexerQuery,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            ProposalTask.Reingest, created_by, query
        )

    async def approve(
        self,
        query: IndexerQuery,
        approve_params: ApproveProposalsParams,
        created_by: str,
    ) -> TaskModel:
        batch = self._batch_repository.get_or_create(
            approve_params.batch, created_by
        )

        return await self._create_task(
            ProposalTask.Approve,
            created_by,
            query,
            ApproveProposalsTaskData(
                batch_id=batch.id, settings=approve_params.settings
            ),
        )

    async def reject(
        self,
        query: IndexerQuery,
        reject_params: RejectProposalsParams,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            ProposalTask.Reject, created_by, query, reject_params
        )

    async def delete(
        self,
        query: IndexerQuery,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(ProposalTask.Delete, created_by, query)
