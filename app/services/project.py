from typing import Literal, Optional

from definitions.project import ProjectStatus
from repositories.group import GroupRepository
from repositories.project import ProjectRepository
from repositories.user import UserRepository
from schemas.assignment import AssignmentChange
from schemas.user import AuthenticatedUser

UpdateProjectStatus = Literal[ProjectStatus.Accepted, ProjectStatus.Declined]


class ProjectService:
    def __init__(
        self,
        project_repository: ProjectRepository,
        group_repository: GroupRepository,
        user_repository: UserRepository,
    ):
        self._project_repository = project_repository
        self._group_repository = group_repository
        self._user_repository = user_repository

    def change_assignment(
        self, project_id: int, assignment_change: AssignmentChange
    ) -> None:
        target_project = self._project_repository.get_by_id(project_id)

        group_ids = {g.id for g in target_project.groups} | set(
            assignment_change.add.group_ids
        ) - set(assignment_change.remove.group_ids)

        user_ids = {u.id for u in target_project.users} | set(
            assignment_change.add.user_ids
        ) - set(assignment_change.remove.user_ids)

        self._project_repository.update_assingment(
            target_project.id,
            [
                self._group_repository.get_by_id(group_id)
                for group_id in group_ids
            ],
            [self._user_repository.get_by_id(user_id) for user_id in user_ids],
        )

    def change_status(
        self,
        project_id: int,
        status: UpdateProjectStatus,
        message: Optional[str],
        user: AuthenticatedUser,
    ) -> None:
        target_project = self._project_repository.get_by_id(project_id)

        if status == target_project.status:
            # TODO: Custom http exception
            raise ValueError(
                f"Project status is already {target_project.status}."
            )

        return self._project_repository.update_status(
            target_project, status, message, user.id
        )
