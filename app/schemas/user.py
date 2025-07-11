from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerNestedModel
from definitions.json import JsonObject
from schemas.watchlist import WatchlistNotification

# --------------------
# - Request Payloads -
# --------------------
UserSettings = JsonObject


# -----------------
# - API Responses -
# -----------------
class UserAssignment(BaseModel):
    user_id: str
    group_ids: List[int]


class UserNotifications(BaseModel):
    watchlist: List[WatchlistNotification]


# --------------------
# - Indexer Entities -
# --------------------
class UserSummary(IndexerNestedModel):
    id: str
    username: str
