from requests import Session

from ._base import BaseRepository
from ._mixins import SaveMixin
from .models.category import CategoryProportionModel


class CategoryProportionRepository(
    BaseRepository,
    SaveMixin[CategoryProportionModel],
):
    def __init__(self, db_session: Session):
        super().__init__(
            db_session, CategoryProportionModel, "Category Proportion"
        )

    def create(
        self, distribution_id: int, category_id: int, proportion: float
    ) -> CategoryProportionModel:
        """
        Create a new category proportion.
        """
        return self.save(
            CategoryProportionModel(
                category_id=category_id,
                distribution_id=distribution_id,
                proportion=proportion,
            )
        )
