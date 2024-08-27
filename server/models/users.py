from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    JSON,
)
from sqlalchemy.orm import relationship, Session
from services.database import Base
from typing import Optional, List
from .base import BaseMixin


class User(Base, BaseMixin):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    settings = Column(JSON)
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="department_users")

    @classmethod
    def find(cls, session: Session, username: str) -> Optional["User"]:
        return session.query(cls).filter_by(username=username).first()

    def save(self, session: Session) -> "User":
        if User.find(session, self.username) is None:
            session.add(self)
        session.commit()
        session.refresh(self)
        return self

    @classmethod
    def add_users_to_department(
        cls, session: Session, department_id: int, users: List[str]
    ):
        for username in users:
            user = cls.find(session, username)
            if user is None:
                user = cls(username=username)
            user.department_id = department_id
            session.add(user)
