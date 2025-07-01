from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerEntity, Keyword
from definitions.json import JsonObject

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
    pass


# --------------------
# - Indexer Entities -
# --------------------
class UserSummary(IndexerEntity):
    id: Keyword
    username: Keyword
