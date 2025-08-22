from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from schemas.addition import (
    Addition,
    AdditionCreate,
    AdditionsBatchParams,
    AdditionsSettingsParams,
)
from schemas.proposal import ApproveProposalsParams

from ._db_indexed_repository import (
    DbIndexedRepository,
    GetByQueryMixin,
    SearchAllMixin,
    SearchCountMixin,
)
from ._db_repository import DbRepository, GetByIdMixin
from .models.addition import AdditionBatchModel, AdditionModel
from .models.proposal import ProposalModel


class AdditionBatchRepository(
    DbRepository[AdditionBatchModel],
    GetByIdMixin[AdditionBatchModel, int],
):
    _entity_name = "Addition Batch"
    _db_model = AdditionBatchModel

    def create(
        self, batch_params: AdditionsBatchParams, created_by: str
    ) -> AdditionBatchModel:
        return self.save(
            AdditionBatchModel(
                name=batch_params.batch_name,
                file_name=batch_params.file_name,
                project_id=batch_params.project_id,
                created_by=created_by,
            )
        )


class AdditionRepository(
    DbIndexedRepository[AdditionModel, Addition],
    GetByQueryMixin[AdditionModel, Addition],
    SearchAllMixin[AdditionModel, Addition],
    SearchCountMixin[AdditionModel, Addition],
):
    _entity_name = "Addition"
    _db_model = AdditionModel
    _indexer_model = Addition

    def create(
        self,
        batch_id: int,
        addition: AdditionCreate,
        settings: AdditionsSettingsParams,
    ) -> AdditionModel:
        return self.save(
            AdditionModel(
                batch_id=batch_id,
                identifier_type=addition.identifier_type,
                identifier_value=addition.identifier_value,
                category_id=addition.category_id,
                priority=addition.priority,
                allow_new_iteration=settings.allow_new_iteration,
                ignore_digitization_check=settings.ignore_digitization_check,
            )
        )

    def create_from_proposal(
        self,
        batch_id: int,
        proposal: ProposalModel,
        params: ApproveProposalsParams,
    ) -> AdditionModel:
        return self.save(
            AdditionModel(
                batch_id=batch_id,
                identifier_type=proposal.identifier_type,
                identifier_value=proposal.identifier_value,
                category_id=params.category_id,
                priority=params.priority,
                proposal_id=proposal.id,
                allow_new_iteration=params.allow_new_iteration,
                ignore_digitization_check=params.ignore_digitization_check,
            )
        )

    def change_status(
        self,
        addition: AdditionModel,
        status: AdditionStatus,
        eligibility_status: EligibilityStatus,
    ) -> AdditionModel:
        addition.status = status
        addition.eligibility_status = eligibility_status

        return self.save(addition)
