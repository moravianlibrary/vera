from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    JSON,
)
from sqlalchemy.orm import relationship, Session
from typing import Optional
from .base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    settings = Column(JSON)
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="users")

    @classmethod
    def find(cls, session: Session, username: str) -> Optional["User"]:
        return session.query(cls).filter_by(username=username).first()

    def is_persisted(self, session: Session) -> bool:
        return User.find(session, self.username) is not None
