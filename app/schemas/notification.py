from typing import List, Union

from pydantic import BaseModel

from schemas.task import TaskNotification
from schemas.watchlist import WatchlistNotification


# -----------------
# - API Responses -
# -----------------
class NotificationsSummary(BaseModel):
    task_count: int
    watchlist_count: int

    task_push: List[TaskNotification]
    watchlist_push: List[WatchlistNotification]


Notification = Union[TaskNotification, WatchlistNotification]
