from repositories.category import CategoryRepository
from repositories.category_proportion import CategoryProportionRepository
from repositories.distribution import DistributionRepository
from schemas.distribution import Distribution, DistributionEditWithProportions


class DistributionService:
    def __init__(
        self,
        category_repository: CategoryRepository,
        distribution_repository: DistributionRepository,
        proportion_repository: CategoryProportionRepository,
    ):
        self._category_repository = category_repository
        self._distribution_repository = distribution_repository
        self._proportion_repository = proportion_repository

    def create(
        self, distribution: DistributionEditWithProportions
    ) -> Distribution:
        distribution_model = self._distribution_repository.create(distribution)

        for proportion in distribution.proportions:
            self._proportion_repository.create(
                distribution_model.id,
                proportion.category_id,
                proportion.proportion,
            )

        self._category_repository.reindex_all()

        return distribution_model

    def update(
        self,
        distribution_id: int,
        distribution: DistributionEditWithProportions,
    ) -> Distribution:
        distribution_model = self._distribution_repository.update(
            distribution_id, distribution
        )
        distribution_model.proportions.clear()

        for proportion in distribution.proportions:
            self._proportion_repository.create(
                distribution_model.id,
                proportion.category_id,
                proportion.proportion,
            )

        self._category_repository.reindex_all()

        return distribution_model
