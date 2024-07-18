from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship, Session
from typing import List, Optional
from services.database import Base
from schemas.types.action_type import ActionType


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)

    role_actions = relationship("RoleAction", back_populates="role")

    @classmethod
    def find(cls, session: Session, role_id: int) -> Optional["Role"]:
        return session.query(cls).filter_by(id=role_id).first()

    @classmethod
    def get(cls, session: Session, role_id: int) -> "Role":
        role = cls.find(session, role_id)
        if role is None:
            raise ValueError(f"Role with id {role_id} not found")
        return role

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Role"]:
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class RoleAction(Base):
    __tablename__ = "actions"

    role_id = Column(
        Integer, ForeignKey("roles.id"), primary_key=True, index=True
    )
    action = Column(Enum(ActionType), primary_key=True)

    role = relationship("Role", back_populates="role_actions")
