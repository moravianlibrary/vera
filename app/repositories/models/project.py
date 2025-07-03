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
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.project import ProjectStatus

from .associations import (
    project_category_association,
    project_group_association,
    project_user_association,
)
from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin

if TYPE_CHECKING:
    from .category import CategoryModel
    from .group import GroupModel
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

    status_log: Mapped[List["ProjectStatusLogModel"]] = relationship(
        "ProjectStatusLogModel",
        backref="project",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    categories: Mapped[List["CategoryModel"]] = relationship(
        "CategoryModel",
        secondary=project_category_association,
        back_populates="projects",
        lazy="joined",
    )
    groups: Mapped[List["GroupModel"]] = relationship(
        "GroupModel",
        secondary=project_group_association,
        back_populates="projects",
        lazy="joined",
    )
    users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        secondary=project_user_association,
        back_populates="projects",
        lazy="joined",
    )


class ProjectStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "project_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(Enum(ProjectStatus), nullable=False)
    message = Column(String, nullable=True)

    project: Mapped["ProjectModel"] = relationship(
        "ProjectModel", backref="status_log"
    )
