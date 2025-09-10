from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.ext.declarative import declared_attr

from .created_audit import CreatedTimestampMixin


class NotificationMixin(CreatedTimestampMixin):
    """
    Mixin for notification models.

    Attributes
    ----------
    id : int
        Primary key for the record.
    user_id : str
        Foreign key referencing the associated user.
    created_at : datetime
        Timestamp indicating when the record was created.
    read_at : datetime | None
        Optional timestamp indicating when the notification was read.
    push_sent : bool
        Indicates whether a push notification has been sent.
    """

    @declared_attr
    def id(cls):
        return Column(Integer, primary_key=True)

    @declared_attr
    def user_id(cls):
        return Column(
            String, ForeignKey("users.id"), index=True, nullable=False
        )

    @declared_attr
    def read_at(cls):
        return Column(TIMESTAMP, nullable=True)

    @declared_attr
    def push_sent(cls):
        return Column(Boolean, nullable=False, default=False)
