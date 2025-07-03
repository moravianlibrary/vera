from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Tuple,
    func,
    select,
)
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel, DatabaseSession
from definitions.category import CategoryDocumentFilter
from repositories.models.document import DocumentModel

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
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    level = Column(Integer, nullable=False)

    assignable = Column(Boolean, nullable=False)
    extract_whole = Column(Boolean, nullable=False)
    disabled = Column(Boolean, default=False, nullable=False)
    archived = Column(Boolean, default=False, nullable=False)

    # Document discovery
    plugin_instance_id = Column(
        Integer, ForeignKey("plugin_instances.id"), nullable=True
    )
    scheduled_task_id = Column(
        Integer, ForeignKey("scheduled_tasks.id"), nullable=True
    )

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

    def total_documents_and_pages(
        self,
        database_session: DatabaseSession,
        filter: CategoryDocumentFilter = CategoryDocumentFilter.All,
    ) -> Tuple[int, int]:
        stmt = (
            select(
                func.count(DocumentModel.id),
                func.sum(DocumentModel.page_count),
            )
            .join(
                DocumentIterationModel,
                DocumentModel.id == DocumentIterationModel.document_id,
            )
            .where(DocumentIterationModel.category_id == self.id)
            .where(DocumentIterationModel.is_archived.is_(False))
        )

        if filter == CategoryDocumentFilter.Extractable:
            stmt = stmt.where(DocumentModel.can_be_extracted.is_(True)).where(
                DocumentIterationModel.digitization_list_id.is_(None)
            )
        elif filter == CategoryDocumentFilter.Extracted:
            stmt = stmt.where(
                DocumentIterationModel.digitization_list_id.is_not(None)
            )

        count, page_sum = database_session.execute(stmt).one()
        return (count or 0, page_sum or 0)


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
