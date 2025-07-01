from typing import Optional

from adapters.database import DatabaseSession
from schemas.project import Project, ProjectEdit

from ._base import BaseRepository
from ._mixins import (
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveMixin,
    SearchMixin,
)
from .models.project import ProjectModel, ProjectStatusLogModel


class ProjectRepository(
    BaseRepository,
    EnforceNameUniquenessMixin[ProjectModel, int],
    GetByIdMixin[ProjectModel, int],
    SaveMixin[ProjectModel],
    SearchMixin[Project],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, ProjectModel, "Project")

    def create(self, project: ProjectEdit) -> ProjectModel:
        """
        Create a new project.
        """
        self.enforce_name_uniqueness(project.name)

        return self.save(
            ProjectModel(
                name=project.name,
                description=project.description,
                target_page_count=project.target_page_count,
                start_date=project.start_date,
                end_date=project.end_date,
            )
        )

    def update(
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

        return self.save(project_model)

    def update_status(
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

        return self.save(project_model)

    def delete(self, project_model: ProjectModel) -> ProjectModel:
        """
        Delete a project.
        """
        # TODO: Add check if has some documents
        self._database_session.delete(project_model)
        self._database_session.commit()
        return project_model
