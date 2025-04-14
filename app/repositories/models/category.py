from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .associations import category_group_association, category_user_association

if TYPE_CHECKING:
    from .distribution import CategoryProportionModel
    from .document_iteration import DocumentIterationModel
    from .group import GroupModel
    from .user import UserModel


class CategoryModel(BaseModel):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"))
    parent_id = Column(Integer, ForeignKey("categories.id"))
    level = Column(Integer, default=0, nullable=False)

    assignable = Column(Boolean, default=False, nullable=False)
    extract_whole = Column(Boolean, default=False, nullable=False)
    disabled = Column(Boolean, default=False, nullable=False)
    archived = Column(Boolean, default=False, nullable=False)

    generator_plugin_id = Column(Integer, ForeignKey("plugins.id"))
    generator_recurring_task_id = Column(
        Integer, ForeignKey("recurring_tasks.id")
    )

    # Hierarchical relationship
    parent: Mapped["CategoryModel" | None] = relationship(
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
        _groups = set(self.groups)

        _category = self.parent
        while _category:
            _groups.update(_category.groups)
            _category = _category.parent

        return list(_groups)

    @property
    def indirect_users(self) -> List["UserModel"]:
        _users = set(self.users)

        _category = self.parent
        while _category:
            _users.update(_category.users)
            _category = _category.parent

        return list(_users)

    # +hasScript(): Boolean
    # +hasRecurringTask(): Boolean
    # +totalPageCount(): Integer
    # +totalDocuments(): Integer
    # +extractablePageCount(): Integer
    # +extractableDocuments(): Integer
    # +extractedPageCount(): Integer
    # +extractedDocuments(): Integer
