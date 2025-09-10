from typing import TYPE_CHECKING, List

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
from definitions.watchlist import WatchlistEvent, WatchlistTarget
from repositories.models.mixins.notification import NotificationMixin

from .mixins.created_audit import CreatedTimestampMixin
from .mixins.watchlist_item import WatchlistItemMixin

if TYPE_CHECKING:
    from .addition import AdditionModel
    from .catalog_record import CatalogRecordModel
    from .category import CategoryModel
    from .document import DocumentIterationModel
    from .project import ProjectModel
    from .proposal import ProposalModel
    from .user import UserModel


class WatchlistModel(BaseModel, CreatedTimestampMixin):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)

    target = Column(Enum(WatchlistTarget), nullable=False)
    query = Column(JSONB, nullable=False)

    additions: Mapped[List["WatchlistAdditionModel"]] = contains(
        "WatchlistAdditionModel", "watchlist"
    )
    catalog_records: Mapped[List["WatchlistCatalogRecordModel"]] = contains(
        "WatchlistCatalogRecordModel", "watchlist"
    )
    categories: Mapped[List["WatchlistCategoryModel"]] = contains(
        "WatchlistCategoryModel", "watchlist"
    )
    document_iterations: Mapped[List["WatchlistDocumentIterationModel"]] = (
        contains("WatchlistDocumentIterationModel", "watchlist")
    )
    projects: Mapped[List["WatchlistProjectModel"]] = contains(
        "WatchlistProjectModel", "watchlist"
    )
    proposals: Mapped[List["WatchlistProposalModel"]] = contains(
        "WatchlistProposalModel", "watchlist"
    )

    subscriptions: Mapped[List["WatchlistSubscriptionModel"]] = contains(
        "WatchlistSubscriptionModel", "watchlist"
    )


class WatchlistAdditionModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_additions"

    addition_id = Column(Integer, ForeignKey("additions.id"))

    addition: Mapped["AdditionModel"] = belongs_to(
        "AdditionModel", "watchlists"
    )
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "additions"
    )


class WatchlistCatalogRecordModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_catalog_records"

    catalog_record_id = Column(String, ForeignKey("catalog_records.id"))

    catalog_record: Mapped["CatalogRecordModel"] = belongs_to(
        "CatalogRecordModel", "watchlists"
    )
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "catalog_records"
    )


class WatchlistCategoryModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_categories"

    category_id = Column(Integer, ForeignKey("categories.id"))

    category: Mapped["CategoryModel"] = belongs_to(
        "CategoryModel", "watchlists"
    )
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "categories"
    )


class WatchlistDocumentIterationModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_document_iterations"

    document_iteration_id = Column(
        Integer, ForeignKey("document_iterations.id")
    )

    document_iteration: Mapped["DocumentIterationModel"] = belongs_to(
        "DocumentIterationModel", "watchlists"
    )
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "document_iterations"
    )


class WatchlistProjectModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_projects"

    project_id = Column(Integer, ForeignKey("projects.id"))

    project: Mapped["ProjectModel"] = belongs_to("ProjectModel", "watchlists")
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "projects"
    )


class WatchlistProposalModel(BaseModel, WatchlistItemMixin):
    __tablename__ = "watchlist_proposals"

    proposal_id = Column(Integer, ForeignKey("proposals.id"))

    proposal: Mapped["ProposalModel"] = belongs_to(
        "ProposalModel", "watchlists"
    )
    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "proposals"
    )


class WatchlistSubscriptionModel(BaseModel):
    __tablename__ = "watchlist_subscriptions"

    id = Column(Integer, primary_key=True)

    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)

    # Email notifications settings
    read_resets_sent = Column(Boolean, nullable=False, default=False)
    cron_expression = Column(String, nullable=True)
    include_report = Column(Boolean, nullable=False, default=True)
    return_fields = Column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("watchlist_id", "user_id"),)

    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "subscriptions"
    )
    user: Mapped["UserModel"] = has_one("UserModel", "watchlist_subscriptions")
    notifications: Mapped[List["WatchlistNotificationModel"]] = contains(
        "WatchlistNotificationModel", "watchlist_subscription"
    )


class WatchlistNotificationModel(BaseModel, NotificationMixin):
    __tablename__ = "watchlist_notifications"

    watchlist_subscription_id = Column(
        Integer, ForeignKey("watchlist_subscriptions.id"), nullable=False
    )
    event = Column(Enum(WatchlistEvent), nullable=False)
    count = Column(Integer, nullable=False, default=1)

    sent_via_email_at = Column(TIMESTAMP, nullable=True)

    watchlist_subscription: Mapped["WatchlistSubscriptionModel"] = belongs_to(
        "WatchlistSubscriptionModel", "notifications"
    )
    user: Mapped["UserModel"] = belongs_to(
        "UserModel", "watchlist_notifications"
    )

    @property
    def watchlist(self) -> WatchlistModel:
        return self.watchlist_subscription.watchlist
