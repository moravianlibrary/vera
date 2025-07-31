from datetime import datetime
from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerQuery
from definitions.watchlist import WatchlistMode, WatchlistTarget
from schemas.common import FilterParams
from schemas.group import GroupSummary
from schemas.user import UserSummary


# --------------------
# - Query Parameters -
# --------------------
class WatchlistParams(BaseModel):
    name: str
    mode: WatchlistMode


class SubscribedWatchlistFilterParams(BaseModel):
    target: WatchlistTarget | None = None
    mode: WatchlistMode | None = None


class WatchlistFilterParams(SubscribedWatchlistFilterParams, FilterParams):
    subscribed_by: str | None = None

    @classmethod
    def from_subscribed_filter(
        cls, filter_: "SubscribedWatchlistFilterParams", user_id: str
    ):
        return cls(
            target=filter_.target, mode=filter_.mode, subscribed_by=user_id
        )


# --------------------
# - Request Payloads -
# --------------------
class WatchlistCreate(WatchlistParams):
    target: WatchlistTarget
    query: IndexerQuery


class WatchlistNotificationSettings(BaseModel):
    read_resets_sent: bool = False
    cron_expression: str | None = None
    include_report: bool = False
    return_fields: List[str] | None = None


# -----------------
# - API Responses -
# -----------------
class WatchlistBase(BaseModel):
    id: int

    name: str

    target: WatchlistTarget
    query: IndexerQuery
    mode: WatchlistMode


class WatchlistSubscription(BaseModel):
    user: UserSummary | None
    group: GroupSummary | None
    settings: WatchlistNotificationSettings | None


class Watchlist(WatchlistBase):
    subscriptions: List[WatchlistSubscription]


class WatchlistNotification(WatchlistBase):
    last_read_at: datetime
    count_changes: int

    # TODO:
    # @classmethod
    # def from_orm_with_count(
    #     cls, notification: WatchlistNotificationModel, count_changes: int
    # ) -> "WatchlistNotification":
    #     return cls(
    #         id=notification.watchlist.id,
    #         name=notification.watchlist.name,
    #         target=notification.watchlist.target,
    #         query=notification.watchlist.query,
    #         mode=notification.watchlist.mode,
    #         last_read_at=notification.last_read_at,
    #         count_changes=count_changes,
    #     )


class SubscribedWatchlist(WatchlistNotification):
    settings: WatchlistNotificationSettings | None
