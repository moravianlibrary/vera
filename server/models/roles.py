from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.orm import Session
from typing import List, Optional
from datatypes import ActionType
from models import BaseModel


class Role(BaseModel):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    _actions = Column("actions", JSON)

    @property
    def actions(self) -> List[ActionType]:
        return (
            [ActionType(item) for item in self._actions]
            if self._actions
            else []
        )

    @actions.setter
    def actions(self, values: List[ActionType]):
        self._actions = [item.value for item in values] if values else []

    @classmethod
    def find_by_name(cls, session: Session, name: str) -> Optional["Role"]:
        return session.query(cls).filter_by(name=name).first()

    @classmethod
    def from_dict(cls, dict_):
        return cls(
            id=dict_.get("id"),
            name=dict_.get("name"),
            _actions=dict_.get("actions"),
        )
