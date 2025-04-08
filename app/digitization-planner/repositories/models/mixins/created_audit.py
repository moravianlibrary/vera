from sqlalchemy import TIMESTAMP, Column, String, func
from sqlalchemy.ext.declarative import declared_attr


class CreatedAuditMixin:
    """
    Mixin for tracking the creation metadata of a record.

    Attributes
    ----------
    created_at : datetime
        Timestamp indicating when the record was created.
        Defaults to the current time on the database server.

    created_by : str
        Identifier of the user or service that created the record.
    """

    @declared_attr
    def created_at(cls):
        return Column(TIMESTAMP, server_default=func.now())

    @declared_attr
    def created_by(cls):
        return Column(String, nullable=False)
