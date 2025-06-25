from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from adapters.database import BaseModel


class RoleModel(BaseModel):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    general_permissions = Column(JSONB, default=list, nullable=False)
    ownership_permissions = Column(JSONB, default=list, nullable=False)
