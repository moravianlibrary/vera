from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Optional
from services.database import Base
from datatypes import ActionType
from .base import BaseMixin


class Role(Base, BaseMixin):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    role_actions = relationship(
        "RoleAction", back_populates="role", cascade="all,delete"
    )

    @hybrid_property
    def actions(self) -> List[ActionType]:
        return [action.action for action in self.role_actions]

    @classmethod
    def find_by_name(cls, session: Session, name: str) -> Optional["Role"]:
        return session.query(cls).filter_by(name=name).first()

    def save_actions(
        self, session: Session, actions: List[ActionType]
    ) -> "Role":
        session.query(RoleAction).filter_by(role_id=self.id).delete()
        session.add_all(
            RoleAction(role_id=self.id, action=action) for action in actions
        )
        session.commit()
        session.refresh(self)
        return self


class RoleAction(Base):
    __tablename__ = "actions"

    role_id = Column(
        Integer, ForeignKey("roles.id"), primary_key=True, index=True
    )
    action = Column(Enum(ActionType), primary_key=True)

    role = relationship("Role", back_populates="role_actions")
