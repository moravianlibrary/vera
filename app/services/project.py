from typing import List, Literal

from definitions.project import ProjectStatus
from definitions.task import AdditionTask, ProposalTask, TaskScope
from errors.project import (
    CannotAddDocumentsToUnapprovedProjectError,
    ProjectStatusAlreadySetError,
    ProjectStatusTransitionError,
)
from repositories.addition import AdditionBatchRepository
from repositories.group import GroupRepository
from repositories.project import ProjectRepository
from repositories.proposal import ProposalBatchRepository
from repositories.task import TaskRepository
from repositories.user import UserRepository
from schemas.addition import (
    AdditionCreate,
    IngestAdditionsParams,
    IngestAdditionsResponse,
    IngestAdditionsTaskData,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import (
    AssignmentChange,
    BatchParams,
    Message,
    PriorityChange,
)
from schemas.project import Project
from schemas.proposal import (
    IngestProposalsResponse,
    IngestProposalsTaskData,
    ProposalCreate,
)
from services.task import TaskBasedService

UpdateProjectStatus = Literal[ProjectStatus.Approved, ProjectStatus.Rejected]


class ProjectService(TaskBasedService):
    def __init__(
        self,
        project_repository: ProjectRepository,
        group_repository: GroupRepository,
        user_repository: UserRepository,
        proposal_batch_repository: ProposalBatchRepository,
        addition_batch_repository: AdditionBatchRepository,
        task_repository: TaskRepository,
    ):
        super().__init__(task_repository)
        self._project_repository = project_repository
        self._group_repository = group_repository
        self._user_repository = user_repository
        self._proposal_batch_repository = proposal_batch_repository
        self._addition_batch_repository = addition_batch_repository

    async def change_assignment(
        self, project_id: int, assignment_change: AssignmentChange
    ) -> Project:
        project = self._project_repository.get_by_id(project_id)

        group_ids = {g.id for g in project.groups}
        user_ids = {u.id for u in project.users}

        if assignment_change.add:
            group_ids |= set(assignment_change.add.groups)
            user_ids |= set(assignment_change.add.users)

        if assignment_change.remove:
            group_ids -= set(assignment_change.remove.groups)
            user_ids -= set(assignment_change.remove.users)

        return await self._project_repository.update_assignment(
            project,
            [
                self._group_repository.get_by_id(group_id)
                for group_id in group_ids
            ],
            [self._user_repository.get_by_id(user_id) for user_id in user_ids],
        )

    async def change_status(
        self,
        project_id: int,
        status: UpdateProjectStatus,
        message: Message | None,
        user: AuthenticatedUser,
    ) -> Project:
        project = self._project_repository.get_by_id(project_id)

        if status == project.status:
            raise ProjectStatusAlreadySetError(project.status)

        if (
            project.status == ProjectStatus.Approved
            and status == ProjectStatus.Rejected
        ):
            raise ProjectStatusTransitionError(
                current_status=project.status,
                attempted_status=status,
            )

        return await self._project_repository.update_status(
            project, status, message.message if message else None, user.id
        )

    def change_priority(
        self, project_id: int, priority_change: PriorityChange
    ) -> Project:
        return self._project_repository.update_priority(
            self._project_repository.get_by_id(project_id),
            priority_change.priority,
        )

    async def propose_documents(
        self,
        project_id: int,
        batch_params: BatchParams,
        proposals: List[ProposalCreate],
        created_by: str,
    ) -> IngestProposalsResponse:
        batch = self._proposal_batch_repository.get_or_create(
            batch_params,
            created_by,
            self._project_repository.get_by_id(project_id).id,
        )

        task = await self._create_task(
            ProposalTask.Ingest,
            created_by,
            data=IngestProposalsTaskData(
                batch_id=batch.id, proposals=proposals
            ),
            task_scope=TaskScope.Proposal,
            name=f"Propose documents for project {project_id}",
        )

        return IngestProposalsResponse(
            batch_id=batch.id, task=self._serialize_task(task)
        )

    async def add_documents(
        self,
        project_id: int,
        ingest_params: IngestAdditionsParams,
        additions: List[AdditionCreate],
        created_by: str,
    ) -> IngestAdditionsResponse:
        project = self._project_repository.get_by_id(project_id)

        if project.status != ProjectStatus.Approved:
            raise CannotAddDocumentsToUnapprovedProjectError()

        batch = self._addition_batch_repository.get_or_create(
            ingest_params.batch,
            created_by,
            project.id,
        )
        settings = ingest_params.settings

        task = await self._create_task(
            AdditionTask.Ingest,
            created_by,
            data=IngestAdditionsTaskData(
                batch_id=batch.id,
                additions=additions,
                allow_new_iteration=settings.allow_new_iteration,
                ignore_digitization_check=settings.ignore_digitization_check,
            ),
            task_scope=TaskScope.Addition,
            name=f"Add documents for project {project_id}",
        )

        return IngestAdditionsResponse(
            batch_id=batch.id, task=self._serialize_task(task)
        )
