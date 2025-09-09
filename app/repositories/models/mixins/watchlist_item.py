from sqlalchemy import TIMESTAMP, Column, ForeignKey, Integer, func
from sqlalchemy.ext.declarative import declared_attr


class WatchlistItemMixin:
    """
    Mixin for tracking items in a watchlist.

    Attributes
    ----------
    id : int
        Primary key for the watchlist item.
    watchlist_id : int
        Foreign key referencing the associated watchlist.
    entered_at : datetime
        Timestamp indicating when the item entered the watchlist.
    exited_at : datetime | None
        Optional timestamp indicating when the item exited the watchlist.
    short_name : str
        Short name of the watchlist.
    active : bool
        Indicates whether the watchlist item is currently active.
    """

    @declared_attr
    def id(cls):
        return Column(Integer, primary_key=True)

    @declared_attr
    def watchlist_id(cls):
        return Column(Integer, ForeignKey("watchlists.id"))

    @declared_attr
    def entered_at(cls):
        return Column(TIMESTAMP, nullable=False, server_default=func.now())

    @declared_attr
    def exited_at(cls):
        return Column(TIMESTAMP, nullable=True)

    @property
    def short_name(self) -> str:
        return self.watchlist.short_name

    @property
    def active(self) -> bool:
        return self.exited_at is None
