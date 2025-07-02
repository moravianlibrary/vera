from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.addition import AdditionStatus
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from repositories.models.project import ProjectModel
from schemas.addition import Addition, AdditionCreate

from ._base import BaseRepository
from ._mixins import GetByQueryMixin, SaveMixin, SearchAllMixin, SearchMixin
from .models.addition import AdditionModel
from .models.proposal import ProposalModel


class AdditionRepository(
    BaseRepository,
    GetByQueryMixin[AdditionModel],
    SaveMixin[AdditionModel],
    SearchMixin[Addition],
    SearchAllMixin[Addition],
):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(
            "Addition",
            database_session,
            AdditionModel,
            indexer_session,
            Addition,
        )

    def create(
        self,
        addition: AdditionCreate,
        batch_id: int,
        created_by: str,
        allow_new_iteration: bool,
        ignore_digitization_check: bool,
        project: ProjectModel | None = None,
    ) -> AdditionModel:
        return self.save_and_index(
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
        return self.save_and_index(
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
        return self.save_and_index(addition)
