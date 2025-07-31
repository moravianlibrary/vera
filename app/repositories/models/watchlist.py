from typing import TYPE_CHECKING, List

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
from definitions.watchlist import WatchlistMode, WatchlistTarget

if TYPE_CHECKING:
    from .user import UserModel


class WatchlistModel(BaseModel):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False, unique=True)
    mode = Column(Enum(WatchlistMode), nullable=False)

    target = Column(Enum(WatchlistTarget), nullable=False)
    query = Column(JSONB, nullable=False)

    subscriptions: Mapped[List["WatchlistSubscriptionModel"]] = contains(
        "WatchlistSubscriptionModel", "watchlist"
    )


class WatchlistSubscriptionModel(BaseModel):
    __tablename__ = "watchlist_subscriptions"

    watchlist_id = Column(
        Integer, ForeignKey("watchlists.id"), primary_key=True
    )
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)

    # Notification settings
    read_resets_sent = Column(Boolean, nullable=False, default=False)
    cron_expression = Column(String, nullable=True)
    include_report = Column(Boolean, nullable=True)
    return_fields = Column(JSONB, nullable=True)

    # Timestamps for tracking
    last_read_at = Column(TIMESTAMP, nullable=False, default=func.now())
    last_sent_at = Column(TIMESTAMP, nullable=False, default=func.now())

    watchlist: Mapped["WatchlistModel"] = belongs_to(
        "WatchlistModel", "subscriptions"
    )
    user: Mapped["UserModel"] = has_one("UserModel", "watchlist_subscriptions")
