from typing import TYPE_CHECKING, List

from sqlalchemy import JSON, Column, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, connected_with, has_many

from .associations.user import (
    category_user_association,
    group_user_association,
    project_user_association,
)

if TYPE_CHECKING:
    from .category import CategoryModel
    from .group import GroupModel
    from .project import ProjectModel
    from .task import TaskNotificationModel
    from .watchlist import (
        WatchlistNotificationModel,
        WatchlistSubscriptionModel,
    )


class UserModel(BaseModel):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    settings = Column(JSON, default={}, nullable=False)

    groups: Mapped[List["GroupModel"]] = connected_with(
        "GroupModel", group_user_association, "users"
    )

    categories: Mapped[List["CategoryModel"]] = connected_with(
        "CategoryModel", category_user_association, "direct_users"
    )
    projects: Mapped[List["ProjectModel"]] = connected_with(
        "ProjectModel", project_user_association, "users"
    )
    watchlist_subscriptions: Mapped[List["WatchlistSubscriptionModel"]] = (
        has_many("WatchlistSubscriptionModel", "user")
    )

    task_notifications: Mapped[List["TaskNotificationModel"]] = has_many(
        "TaskNotificationModel", "user"
    )
    watchlist_notifications: Mapped[List["WatchlistNotificationModel"]] = (
        has_many("WatchlistNotificationModel", "user")
    )
