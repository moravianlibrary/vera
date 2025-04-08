from sqlalchemy import TIMESTAMP, Column, String, func
from sqlalchemy.ext.declarative import declared_attr


class UpdatedAuditMixin:
    """
    Mixin for tracking the update metadata of a record.

    Attributes
    ----------
    updated_at : datetime
        Timestamp indicating when the record was last updated.
        Defaults to the current time on the database server.

    updated_by : str
        Identifier of the user or service that last updated the record.
    """

    @declared_attr
    def updated_at(cls):
        return Column(
            TIMESTAMP, server_default=func.now(), onupdate=func.now()
        )

    @declared_attr
    def updated_by(cls):
        return Column(String, nullable=False)
