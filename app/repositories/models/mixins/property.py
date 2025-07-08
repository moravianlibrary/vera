from sqlalchemy import Column, LargeBinary
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declared_attr


class PropertyDataMixin:
    """
    Mixin for storing plugin defined properties.

    Attributes
    ----------
    search_data:
        JSON-serializable search metadata.
    detailed_data:
        JSON-serializable detailed metadata.
    internal_data:
        Binary blob (pickled or encoded), handled by plugin.
    """

    @declared_attr
    def search_data(cls):
        return Column(JSONB, nullable=True)

    @declared_attr
    def detailed_data(cls):
        return Column(JSONB, nullable=True)

    @declared_attr
    def internal_data(cls):
        return Column(LargeBinary, nullable=True)
