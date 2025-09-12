from typing import TYPE_CHECKING, List, Optional

from schemas.project import Project, ProjectEdit

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import EnforceNameUniquenessMixin, GetByIdMixin
from .models.project import ProjectModel, ProjectStatusLogModel

if TYPE_CHECKING:
    from .group import GroupModel
    from .user import UserModel


class ProjectRepository(
    DbIndexedRepository[ProjectModel, Project],
    GetByIdMixin[ProjectModel, int],
    EnforceNameUniquenessMixin[ProjectModel, int],
):
    _entity_name = "Project"
    _db_model = ProjectModel
    _indexer_model = Project
    _wait_for_index_refresh = True

    async def create(
        self, project: ProjectEdit, created_by: str
    ) -> ProjectModel:
        """
        Create a new project.
        """
        self.enforce_name_uniqueness(project.name)

        return await self.save(
            ProjectModel(
                name=project.name,
                description=project.description,
                target_page_count=project.target_page_count,
                start_date=project.start_date,
                end_date=project.end_date,
                created_by=created_by,
            )
        )

    async def update(
        self, project_model: ProjectModel, project: ProjectEdit
    ) -> ProjectModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(project.name, project_model.id)

        project_model.name = project.name
        project_model.description = project.description
        project_model.target_page_count = project.target_page_count
        project_model.start_date = project.start_date
        project_model.end_date = project.end_date

        return await self.save(project_model)

    async def update_assignment(
        self,
        project: ProjectModel,
        groups: List["GroupModel"],
        users: List["UserModel"],
    ) -> ProjectModel:
        project.groups = groups
        project.users = users

        return await self.save(project)

    async def update_status(
        self,
        project_model: ProjectModel,
        status: str,
        message: Optional[str],
        updated_by: str,
    ) -> ProjectModel:
        """
        Update the status of a project.
        """
        project_model.status = status

        self._database_session.add(
            ProjectStatusLogModel(
                project_id=project_model.id,
                status=status,
                message=message,
                updated_by=updated_by,
            )
        )

        return await self.save(project_model)

    async def update_priority(
        self, project_model: ProjectModel, priority: int
    ) -> ProjectModel:
        project_model.priority = priority

        return await self.save(project_model)

    async def delete(self, project: ProjectModel) -> ProjectModel:
        """
        Delete a project.
        """
        # TODO: Add check if has some documents

        return await super().delete(project)
