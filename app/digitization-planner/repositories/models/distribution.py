from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

if TYPE_CHECKING:
    from .category import CategoryModel


class DistributionModel(BaseModel):
    __tablename__ = "distributions"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)

    proportions: Mapped[List["CategoryProportionModel"]] = relationship(
        "CategoryProportionModel",
        back_populates="distribution",
        lazy="joined",
        cascade="all, delete-orphan",
    )


class CategoryProportionModel(BaseModel):
    __tablename__ = "category_proportions"

    category_id = Column(
        Integer, ForeignKey("categories.id"), primary_key=True
    )
    distribution_id = Column(
        Integer, ForeignKey("distributions.id"), primary_key=True
    )
    proportion = Column(Float)

    categories: Mapped["CategoryModel"] = relationship(
        "CategoryModel",
        back_populates="proportions",
        lazy="joined",
    )
    distribution: Mapped["DistributionModel"] = relationship(
        "DistributionModel",
        back_populates="proportions",
        lazy="joined",
    )
