from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Enum, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped
from vera_plugins.definitions.plugin_types import PluginType

from adapters.database import BaseModel, has_many, has_one

from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin

if TYPE_CHECKING:
    from .catalog_record import CatalogRecordPropertyModel
    from .document import DocumentPropertyModel


class PluginModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False, unique=True)
    type = Column(Enum(PluginType), nullable=False)

    meta = Column(JSONB, nullable=False)

    data = Column(LargeBinary, nullable=False)

    instances: Mapped[List["PluginInstanceModel"]] = has_many(
        "PluginInstanceModel", "plugin"
    )


class PluginInstanceModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "plugin_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)

    plugin_id = Column(Integer, ForeignKey("plugins.id"), nullable=False)
    name = Column(String, nullable=False)

    config = Column(JSONB, nullable=True)

    plugin: Mapped["PluginModel"] = has_one("PluginModel", "instances")

    catalog_record_properties: Mapped[List["CatalogRecordPropertyModel"]] = (
        has_many("CatalogRecordPropertyModel", "plugin_instance")
    )
    document_properties: Mapped[List["DocumentPropertyModel"]] = has_many(
        "DocumentPropertyModel", "plugin_instance"
    )
