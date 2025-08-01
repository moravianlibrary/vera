from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
    select,
)
from sqlalchemy.orm import Mapped

from adapters.database import (
    BaseModel,
    DatabaseSession,
    belongs_to,
    connected_with,
    contains,
    has_many,
)
from definitions.category import CategoryDocumentFilter
from repositories.models.document import DocumentModel

from .associations import (
    category_group_association,
    category_user_association,
    project_category_association,
)

if TYPE_CHECKING:
    from .document import DocumentIterationModel
    from .group import GroupModel
    from .project import ProjectModel
    from .proposal import ProposalModel
    from .task import TaskCategoryModel
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
    task_schedule_id = Column(
        Integer, ForeignKey("task_schedules.id"), nullable=True
    )

    # Hierarchical relationship
    children: Mapped[List["CategoryModel"]] = contains(
        "CategoryModel", "parent"
    )
    parent: Mapped[Optional["CategoryModel"]] = belongs_to(
        "CategoryModel", "children", remote_side=[id]
    )

    # Proportions for distributions
    proportions: Mapped[List["CategoryProportionModel"]] = contains(
        "CategoryProportionModel", "category"
    )

    # Relationships to other entities
    document_iterations: Mapped[List["DocumentIterationModel"]] = has_many(
        "DocumentIterationModel", "category"
    )
    projects: Mapped[List["ProjectModel"]] = connected_with(
        "ProjectModel", project_category_association, "categories"
    )
    proposals: Mapped[List["ProposalModel"]] = has_many(
        "ProposalModel", "category"
    )
    task_items: Mapped[List["TaskCategoryModel"]] = contains(
        "TaskCategoryModel", "category"
    )

    # Ownership relationships
    assigned_groups: Mapped[List["GroupModel"]] = connected_with(
        "GroupModel", category_group_association, "categories"
    )
    assigned_users: Mapped[List["UserModel"]] = connected_with(
        "UserModel", category_user_association, "categories"
    )

    @property
    def path(self) -> List[Dict[str, int | str]]:
        path = []
        current_category = self
        while current_category:
            path.append(
                {"id": current_category.id, "name": current_category.name}
            )
            current_category = current_category.parent
        return path[::-1]

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

    proportions: Mapped[List["CategoryProportionModel"]] = contains(
        "CategoryProportionModel", "distribution"
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

    category: Mapped["CategoryModel"] = belongs_to(
        "CategoryModel", "proportions"
    )
    distribution: Mapped["DistributionModel"] = belongs_to(
        "DistributionModel", "proportions"
    )
