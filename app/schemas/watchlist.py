from datetime import datetime
from typing import List

from esorm.fields import keyword, long, text
from pydantic import BaseModel

from adapters.indexer import IndexerNestedModel, IndexerQuery
from definitions.watchlist import WatchlistEvent, WatchlistTarget
from schemas.common import Notification, PageParams
from schemas.user import UserSummary


# --------------------
# - Query Parameters -
# --------------------
class WatchlistPropertiesParams(BaseModel):
    name: str
    description: str | None = None


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
    description: str | None

    target: WatchlistTarget
    query: IndexerQuery


class WatchlistSubscription(BaseModel):
    user: UserSummary
    settings: WatchlistNotificationSettings | None


class Watchlist(WatchlistBase):
    subscriptions: List[WatchlistSubscription]


# class SubscribedWatchlist(WatchlistNotification):
# settings: WatchlistNotificationSettings | None


class WatchlistNotificationSummary(BaseModel):
    id: int
    name: str


class WatchlistNotification(Notification):
    event: WatchlistEvent
    count: int

    sent_via_email_at: datetime | None

    watchlist: WatchlistNotificationSummary


# --------------------
# - Indexer Entities -
# --------------------
class WatchlistSummary(IndexerNestedModel):
    id: long
    name: keyword
    description: text | None = None
    entered_at: datetime
    exited_at: datetime | None = None
    active: bool


# -------------
# - Task Data -
# -------------
class WatchlistChangeTaskData(BaseModel):
    watchlist_id: int
