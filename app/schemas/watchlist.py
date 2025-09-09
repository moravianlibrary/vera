from datetime import datetime
from typing import List

from esorm.fields import keyword, long, text
from pydantic import BaseModel

from adapters.indexer import IndexerNestedModel, IndexerQuery
from definitions.watchlist import WatchlistEvent, WatchlistTarget
from schemas.common import PageParams
from schemas.user import UserSummary


# --------------------
# - Query Parameters -
# --------------------
class WatchlistPropertiesParams(BaseModel):
    name: str
    short_name: str


class WatchlistFilterParams(BaseModel):
    target: WatchlistTarget | None = None


class WatchlistPaginateParams(PageParams, WatchlistFilterParams):
    pass

    @property
    def page_params(self) -> PageParams:
        return PageParams(page=self.page, page_size=self.page_size)

    @property
    def filter_params(self) -> WatchlistFilterParams:
        return WatchlistFilterParams(target=self.target)


# --------------------
# - Request Payloads -
# --------------------
class WatchlistProperties(WatchlistPropertiesParams):
    pass


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
    mode: WatchlistEvent


class WatchlistSubscription(BaseModel):
    user: UserSummary
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


# --------------------
# - Indexer Entities -
# --------------------
class WatchlistSummary(IndexerNestedModel):
    id: long
    name: text
    short_name: keyword
    entered_at: datetime
    exited_at: datetime | None = None
    active: bool


# -------------
# - Task Data -
# -------------
class WatchlistChangeTaskData(BaseModel):
    watchlist_id: int
