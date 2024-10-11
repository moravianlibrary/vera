from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    JSON,
)
from sqlalchemy.orm import relationship, Session, Query
from typing import Optional, List
from .base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True, unique=True)
    settings = Column(JSON, default={})
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="users")

    @property
    def department_name(self) -> Optional[str]:
        return self.department.name if self.department is not None else None

    @property
    def department_categories_ids(self) -> Optional[List[int]]:
        return (
            [category.id for category in self.department.categories]
            if self.department is not None
            else None
        )

    @classmethod
    def find(cls, session: Session, username: str) -> Optional["User"]:
        return session.query(cls).filter_by(username=username).first()

    @classmethod
    def query_base(cls, session: Session) -> Query:
        return session.query(cls).order_by(cls.username)

    def is_persisted(self, session: Session) -> bool:
        return User.find(session, self.username) is not None
