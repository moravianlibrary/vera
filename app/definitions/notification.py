from enum import Enum


class NotificationType(str, Enum):
    Task = "task"
    Watchlist = "watchlist"
