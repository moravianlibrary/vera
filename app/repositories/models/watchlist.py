from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
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

    subscriptions: Mapped[List["WatchlistSubscriptionModel"]] = relationship(
        "WatchlistSubscriptionModel",
        back_populates="watchlist",
        cascade="all, delete-orphan",
    )


class WatchlistSubscriptionModel(BaseModel):
    __tablename__ = "watchlist_subscriptions"

    watchlist_id = Column(
        Integer, ForeignKey("watchlists.id"), primary_key=True
    )
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)

    # Notification settings
    cron_expression = Column(String, nullable=True)
    include_report = Column(Integer, nullable=True)
    return_fields = Column(JSONB, nullable=True)

    watchlist: Mapped["WatchlistModel"] = relationship(
        "WatchlistModel",
        back_populates="subscriptions",
        foreign_keys=[watchlist_id],
    )

    users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        back_populates="watchlist_subscriptions",
        lazy="joined",
    )
