from typing import List

from esorm import ESBaseModel
from pydantic import BaseModel

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
class UserSummary(ESBaseModel):
    id: str
    username: str
