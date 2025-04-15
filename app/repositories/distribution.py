from requests import Session

from schemas import DistributionEdit

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models import DistributionModel


class DistributionRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, DistributionModel, "Distribution")

    def create(self, distribution: DistributionEdit) -> DistributionModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(distribution.name)
        return self.save(
            DistributionModel(
                name=distribution.name, description=distribution.description
            )
        )

    def update(
        self, distribution_id: int, distribution: DistributionEdit
    ) -> DistributionModel:
        """
        Update an existing role.
        """
        role_model: DistributionModel = self.get_by_id(distribution_id)
        self.enforce_name_uniqueness(distribution.name, distribution_id)
        role_model.name = distribution.name
        role_model.description = distribution.description
        return self.save(role_model)
