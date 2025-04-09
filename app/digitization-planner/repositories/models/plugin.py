from sqlalchemy import JSON, Boolean, Column, Enum, Integer, String

from adapters.database import BaseModel
from custom_types import PluginType

from .mixins import CreatedAuditMixin, UpdatedAuditMixin


class PluginModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, autoincrement=True)

    type = Column(Enum(PluginType), nullable=False)
    name = Column(String, nullable=False)

    code = Column(String, nullable=False)
    config = Column(JSON, nullable=True)

    run_in_safe_mode = Column(Boolean, default=False, nullable=False)

    __table_args__ = (unique_constraint("name", "type"),)
