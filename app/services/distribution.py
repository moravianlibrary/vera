from repositories.category_proportion import CategoryProportionRepository
from repositories.distribution import DistributionRepository
from schemas.category import Distribution, DistributionEditWithProportions


class DistributionService:
    def __init__(
        self,
        distribution_r: DistributionRepository,
        proportion_r: CategoryProportionRepository,
    ):
        self.distribution_r = distribution_r
        self.proportion_r = proportion_r

    def create(
        self, distribution: DistributionEditWithProportions
    ) -> Distribution:
        distribution_model = self.distribution_r.create(distribution)
        for proportion in distribution.proportions:
            self.proportion_r.create(
                distribution_model.id,
                proportion.category_id,
                proportion.proportion,
            )
        # TODO: Reindex categories
        return distribution_model

    def update(
        self,
        distribution_id: int,
        distribution: DistributionEditWithProportions,
    ) -> Distribution:
        distribution_model = self.distribution_r.update(
            distribution_id, distribution
        )
        distribution_model.proportions.clear()
        for proportion in distribution.proportions:
            self.proportion_r.create(
                distribution_model.id,
                proportion.category_id,
                proportion.proportion,
            )
        # TODO: Reindex categories
        return distribution_model
