from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship, Session
from services.database import Base
from typing import List, Optional


class User(Base):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="department_users")

    @classmethod
    def find(cls, session: Session, user_id: int) -> Optional["User"]:
        return session.query(cls).filter_by(id=user_id).first()

    @classmethod
    def get(cls, session: Session, user_id: int) -> "User":
        user = cls.find(session, user_id)
        if user is None:
            raise ValueError(f"User with id {user_id} not found")
        return user

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["User"]:
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
