from typing import List

from sqlalchemy import Column, Enum, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, relationship
from vera_plugins.definitions.plugin_types import PluginType

from adapters.database import BaseModel

from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin


class PluginModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False, unique=True)
    type = Column(Enum(PluginType), nullable=False)

    meta = Column(JSONB, nullable=False)

    data = Column(LargeBinary, nullable=False)

    instances: Mapped[List["PluginInstanceModel"]] = relationship(
        "PluginInstanceModel", backref="plugin"
    )


class PluginInstanceModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "plugin_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)

    plugin_id = Column(Integer, ForeignKey("plugins.id"), nullable=False)
    name = Column(String, nullable=False)

    config = Column(JSONB, nullable=True)

    plugin: Mapped["PluginModel"] = relationship(
        "PluginModel", backref="instances"
    )
