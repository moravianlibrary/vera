from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship, Session
from services.database import Base
from typing import Optional, List
from .base import BaseMixin


class User(Base, BaseMixin):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="department_users")

    @classmethod
    def find_by_name(cls, session: Session, username: str) -> Optional["User"]:
        return session.query(cls).filter_by(username=username).first()

    @classmethod
    def add_users_to_department(
        cls, session: Session, department_id: int, users: List[str]
    ):
        for username in users:
            user = cls.find_by_name(session, username)
            if user is None:
                user = cls(username=username)
            user.department_id = department_id
            session.add(user)
