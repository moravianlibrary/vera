from typing import TYPE_CHECKING, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    and_,
    distinct,
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
    db_view,
    has_many,
    has_one,
)

from .associations import (
    category_group_association,
    category_user_association,
    project_category_association,
)
from .document import DocumentIterationModel, DocumentModel
from .mixins.created_audit import CreatedTimestampMixin

if TYPE_CHECKING:
    from .group import GroupModel
    from .plugin import PluginInstanceModel
    from .project import ProjectModel
    from .task import TaskCategoryModel
    from .user import UserModel


class CategoryModel(BaseModel, CreatedTimestampMixin):
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
    document_discovery_id = Column(
        Integer, ForeignKey("plugin_instances.id"), nullable=True
    )
    document_discovery_schedule_id = Column(
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
    task_items: Mapped[List["TaskCategoryModel"]] = contains(
        "TaskCategoryModel", "category"
    )
    document_discovery: Mapped["PluginInstanceModel"] = has_one(
        "PluginInstanceModel", "categories"
    )

    # Ownership relationships
    direct_groups: Mapped[List["GroupModel"]] = connected_with(
        "GroupModel", category_group_association, "categories"
    )
    direct_users: Mapped[List["UserModel"]] = connected_with(
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
    def effective_groups(self) -> List["GroupModel"]:
        groups = list(self.direct_groups)
        processed_groups = set(g.id for g in groups)

        category = self.parent
        while category:
            for group in category.direct_groups:
                if group.id not in processed_groups:
                    groups.append(group)
                    processed_groups.add(group.id)
            category = category.parent

        return groups

    @property
    def effective_users(self) -> List["UserModel"]:
        users = list(self.direct_users)
        processed_user_ids = {u.id for u in users}

        category = self.parent
        while category:
            for user in category.direct_users:
                if user.id not in processed_user_ids:
                    users.append(user)
                    processed_user_ids.add(user.id)
            category = category.parent

        return users

    @db_view
    def get_statistics(self, db_session: DatabaseSession) -> Dict[str, int]:
        FILTER_TOTAL = DocumentIterationModel.is_archived.is_(False)
        FILTER_EXTRACTABLE = and_(
            FILTER_TOTAL,
            DocumentModel.can_be_extracted.is_(True),
            DocumentIterationModel.digitization_list_id.is_(None),
        )
        FILTER_EXTRACTED = and_(
            FILTER_TOTAL,
            DocumentIterationModel.digitization_list_id.isnot(None),
        )

        stmt = (
            select(
                func.count(DocumentIterationModel.id)
                .filter(FILTER_TOTAL)
                .label("count_total_documents"),
                func.coalesce(
                    func.sum(DocumentModel.page_count).filter(FILTER_TOTAL),
                    0,
                ).label("count_total_pages"),
                func.count(DocumentIterationModel.id)
                .filter(FILTER_EXTRACTABLE)
                .label("count_extractable_documents"),
                func.coalesce(
                    func.sum(DocumentModel.page_count).filter(
                        FILTER_EXTRACTABLE
                    ),
                    0,
                ).label("count_extractable_pages"),
                func.count(distinct(DocumentIterationModel.document_id))
                .filter(FILTER_EXTRACTED)
                .label("count_extracted_documents"),
                func.coalesce(
                    func.sum(DocumentModel.page_count).filter(
                        FILTER_EXTRACTED
                    ),
                    0,
                ).label("count_extracted_pages"),
            )
            .select_from(CategoryModel)
            .outerjoin(
                DocumentIterationModel,
                DocumentIterationModel.category_id == CategoryModel.id,
            )
            .outerjoin(
                DocumentModel,
                DocumentModel.id == DocumentIterationModel.document_id,
            )
            .where(CategoryModel.id == self.id)
            .group_by(CategoryModel.id)
        )

        return db_session.execute(stmt).first()._mapping


# TODO: Audits
class DistributionModel(BaseModel):
    __tablename__ = "distributions"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False, unique=True)
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
    proportion = Column(Numeric(5, 4), nullable=False)

    category: Mapped["CategoryModel"] = belongs_to(
        "CategoryModel", "proportions"
    )
    distribution: Mapped["DistributionModel"] = belongs_to(
        "DistributionModel", "proportions"
    )
