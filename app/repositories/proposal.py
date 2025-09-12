from definitions.eligibility import EligibilityStatus
from definitions.proposal import ProposalStatus
from errors.common import (
    BatchParamsConflictError,
    BatchPermissionDeniedError,
    BatchProjectMismatchError,
)
from repositories._db_repository import DbRepository, GetByIdMixin
from schemas.proposal import BatchParams, Proposal, ProposalCreate

from ._db_indexed_repository import (
    DbIndexedRepository,
    GetByQueryMixin,
    SearchAllMixin,
)
from .models.proposal import ProposalBatchModel, ProposalModel


class ProposalBatchRepository(
    DbRepository[ProposalBatchModel],
    GetByIdMixin[ProposalBatchModel, int],
):
    _entity_name = "Proposal Batch"
    _db_model = ProposalBatchModel

    def get_or_create(
        self,
        batch_params: BatchParams,
        created_by: str,
        project_id: int | None = None,
    ) -> ProposalBatchModel:
        if batch_params.batch_id and (
            batch_params.batch_name or batch_params.file_name
        ):
            raise BatchParamsConflictError()

        if batch_params.batch_id is not None:
            batch = self.get_by_id(batch_params.batch_id)

            if batch.created_by != created_by:
                raise BatchPermissionDeniedError()

            if batch.project_id != project_id:
                raise BatchProjectMismatchError()

            return batch

        return self.save(
            ProposalBatchModel(
                name=batch_params.batch_name,
                file_name=batch_params.file_name,
                created_by=created_by,
                project_id=project_id,
            )
        )


class ProposalRepository(
    DbIndexedRepository[ProposalModel, Proposal],
    GetByQueryMixin[ProposalModel, Proposal],
    SearchAllMixin[ProposalModel, Proposal],
):
    _entity_name = "Proposal"
    _db_model = ProposalModel
    _indexer_model = Proposal

    async def create(
        self, batch_id: int, proposal: ProposalCreate
    ) -> ProposalModel:
        return self.save(
            ProposalModel(
                batch_id=batch_id,
                identifier_type=proposal.identifier_type,
                identifier_value=proposal.identifier_value,
                justification=proposal.justification,
            )
        )

    async def change_status(
        self,
        proposal: ProposalModel,
        status: ProposalStatus,
        eligibility_status: EligibilityStatus,
    ) -> ProposalModel:
        proposal.status = status
        proposal.eligibility_status = eligibility_status

        return await self.save(proposal)
