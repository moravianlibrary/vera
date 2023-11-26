from sqlalchemy import Column, Enum, ForeignKey, Integer, String

from services.database import Base
from roles.enums import ActionType


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)


class Action(Base):
    __tablename__ = "actions"

    role_id = Column(Integer, ForeignKey('roles.id'),
                     primary_key=True, index=True)
    action = Column(Enum(ActionType), primary_key=True, index=True)
