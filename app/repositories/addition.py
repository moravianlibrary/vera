from definitions.addition import AdditionStatus
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from schemas.addition import Addition, AdditionCreate

from ._db_indexed_repository import (
    DbIndexedRepository,
    GetByQueryMixin,
    SearchAllMixin,
    SearchCountMixin,
)
from ._db_repository import DbRepository, GetByIdMixin
from .models.addition import AdditionBatchModel, AdditionModel
from .models.project import ProjectModel
from .models.proposal import ProposalModel


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
        addition: AdditionCreate,
        batch_id: int,
        created_by: str,
        allow_new_iteration: bool,
        ignore_digitization_check: bool,
        project: ProjectModel | None = None,
    ) -> AdditionModel:
        return self.save(
            AdditionModel(
                batch_id=batch_id,
                identifier_type=addition.identifier_type,
                identifier_value=addition.identifier_value,
                category_id=addition.category_id,
                priority=project.priority if project else addition.priority,
                project_id=project.id if project else None,
                created_by=created_by,
                allow_new_iteration=allow_new_iteration,
                ignore_digitization_check=ignore_digitization_check,
            )
        )

    def create_from_proposal(
        self,
        proposal: ProposalModel,
        batch_id: int,
        category_id: int,
        priority: Priority,
        created_by: str,
        allow_new_iteration: bool,
        ignore_digitization_check: bool,
    ) -> AdditionModel:
        return self.save(
            AdditionModel(
                batch_id=batch_id,
                identifier_type=proposal.identifier_type,
                identifier_value=proposal.identifier_value,
                category_id=category_id,
                priority=priority,
                project_id=proposal.project_id,
                proposal_id=proposal.id,
                created_by=created_by,
                allow_new_iteration=allow_new_iteration,
                ignore_digitization_check=ignore_digitization_check,
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


class AdditionBatchRepository(
    DbRepository[AdditionBatchModel],
    GetByIdMixin[AdditionBatchModel, int],
):
    _entity_name = "Addition Batch"
    _db_model = AdditionBatchModel

    def create(
        self, name: str, file_name: str, created_by: str
    ) -> AdditionBatchModel:
        return self.save(
            AdditionBatchModel(
                name=name, file_name=file_name, created_by=created_by
            )
        )
