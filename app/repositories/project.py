from requests import Session

from schemas import ProjectEdit

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models import ProjectModel


class ProjectRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session):
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

    def update(self, project_id: int, project: ProjectEdit) -> ProjectModel:
        """
        Update an existing role.
        """
        project_model: ProjectModel = self.get_by_id(project_id)

        self.enforce_name_uniqueness(project.name, project_id)

        project_model.name = project.name
        project_model.description = project.description
        project_model.target_page_count = project.target_page_count
        project_model.start_date = project.start_date
        project_model.end_date = project.end_date

        return self.save(project_model)
