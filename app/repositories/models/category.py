from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .associations import category_group_association, category_user_association

if TYPE_CHECKING:
    from .document import DocumentIterationModel
    from .group import GroupModel
    from .user import UserModel


class CategoryModel(BaseModel):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"))
    parent_id = Column(Integer, ForeignKey("categories.id"))
    level = Column(Integer, nullable=False)

    assignable = Column(Boolean, nullable=False)
    extract_whole = Column(Boolean, nullable=False)
    disabled = Column(Boolean, default=False, nullable=False)
    archived = Column(Boolean, default=False, nullable=False)

    # Hierarchical relationship
    parent: Mapped[Optional["CategoryModel"]] = relationship(
        "CategoryModel",
        remote_side=[id],
        backref="children",
        lazy="joined",
    )
    children: Mapped[List["CategoryModel"]] = relationship(
        "CategoryModel",
        back_populates="parent",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    # Relationships to other entities
    proportions: Mapped[List["CategoryProportionModel"]] = relationship(
        "CategoryProportionModel",
        back_populates="categories",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    document_iterations: Mapped[List["DocumentIterationModel"]] = relationship(
        "DocumentIterationModel",
        back_populates="category",
        lazy="joined",
    )

    # Ownership relationships
    assigned_groups: Mapped[List["GroupModel"]] = relationship(
        "GroupModel",
        secondary=category_group_association,
        back_populates="categories",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    assigned_users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        secondary=category_user_association,
        back_populates="categories",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    @property
    def indirect_groups(self) -> List["GroupModel"]:
        _groups = set(self.assigned_groups)

        _category = self.parent
        while _category:
            _groups.update(_category.assigned_groups)
            _category = _category.parent

        return list(_groups)

    @property
    def indirect_users(self) -> List["UserModel"]:
        _users = set(self.assigned_users)

        _category = self.parent
        while _category:
            _users.update(_category.assigned_users)
            _category = _category.parent

        return list(_users)

    # +hasScript(): bool
    # +hasRecurringTask(): bool
    # +totalPageCount(): int
    # +totalDocuments(): int
    # +extractablePageCount(): int
    # +extractableDocuments(): int
    # +extractedPageCount(): int
    # +extractedDocuments(): int


# TODO: Audits
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
