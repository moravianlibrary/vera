from adapters.database import DatabaseSession
from schemas.distribution import DistributionEdit

from ._base import BaseRepository
from ._database_mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models.category import DistributionModel


class DistributionRepository(
    BaseRepository,
    DeleteMixin[DistributionModel],
    EnforceNameUniquenessMixin[DistributionModel, int],
    GetByIdMixin[DistributionModel, int],
    PaginationMixin[DistributionModel],
    SaveMixin[DistributionModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, DistributionModel, "Distribution")

    def create(self, distribution: DistributionEdit) -> DistributionModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(distribution.name)
        return self.save(
            DistributionModel(
                name=distribution.name,
                description=distribution.description,
                is_active=(
                    self._database_session.query(DistributionModel)
                    .filter(DistributionModel.is_active.is_(True))
                    .first()
                    is None
                ),
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

    def set_as_active(self, distribution_id: int) -> DistributionModel:
        """
        Set a distribution as active.
        """
        distribution_model = self.get_by_id(distribution_id)

        self._database_session.query(DistributionModel).filter(
            DistributionModel.is_active.is_(True)
        ).update({"is_active": False})

        distribution_model.is_active = True
        return self.save(distribution_model)
