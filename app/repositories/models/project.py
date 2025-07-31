from typing import TYPE_CHECKING, List

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped

from adapters.database import (
    BaseModel,
    belongs_to,
    connected_with,
    contains,
    has_many,
    has_one,
)
from definitions.project import ProjectStatus

from .associations import (
    project_category_association,
    project_group_association,
    project_user_association,
)
from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin

if TYPE_CHECKING:
    from .addition import AdditionModel
    from .category import CategoryModel
    from .group import GroupModel
    from .intention import IntentionModel
    from .proposal import ProposalModel
    from .user import UserModel


class ProjectModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    target_page_count = Column(Integer)
    start_date = Column(TIMESTAMP)
    end_date = Column(TIMESTAMP)

    status = Column(
        Enum(ProjectStatus), default=ProjectStatus.Proposed, nullable=False
    )

    is_archived = Column(Boolean, default=False, nullable=False)

    status_log: Mapped[List["ProjectStatusLogModel"]] = contains(
        "ProjectStatusLogModel", "project", "dynamic"
    )

    # Relationships to other entities
    additions: Mapped[List["AdditionModel"]] = has_many(
        "AdditionModel", "project"
    )
    categories: Mapped[List["CategoryModel"]] = connected_with(
        "CategoryModel", project_category_association, "projects"
    )
    intention: Mapped["IntentionModel"] = has_one("IntentionModel", "project")
    proposals: Mapped[List["ProposalModel"]] = has_many(
        "ProposalModel", "project"
    )

    # Ownership relationships
    groups: Mapped[List["GroupModel"]] = connected_with(
        "GroupModel", project_group_association, "projects"
    )
    users: Mapped[List["UserModel"]] = connected_with(
        "UserModel",
        project_user_association,
        "projects",
    )


class ProjectStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "project_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(Enum(ProjectStatus), nullable=False)
    message = Column(String, nullable=True)

    project: Mapped["ProjectModel"] = belongs_to("ProjectModel", "status_log")
