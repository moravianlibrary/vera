from sqlalchemy import Boolean, Column, Enum, Integer, String, Timestamp

from adapters.database import BaseModel


class PluginModel(BaseModel):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, autoincrement=True)

    type = Column(Enum(PluginType), nullable=False)
    name = Column(String, nullable=False)

    code = Column(String, nullable=False)
    config = Column(String, nullable=True)

    run_in_safe_mode = Column(Boolean, default=False, nullable=False)

    __table_args__ = (unique_constraint("name", "type"),)
