from typing import List
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from .base import BaseMixin
from .users import User


class Department(Base, BaseMixin):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String, unique=True)
    name = Column(String, unique=True)

    department_users = relationship("User", back_populates="department")

    @hybrid_property
    def users(self) -> List[str]:
        return [user.username for user in self.department_users]

    def save_users(self, db: Session, usernames: List[str]):
        for username in usernames:
            user = User.find(db, username)
            if user is None:
                user = User(username=username)
            user.department_id = self.id
            db.add(user)
        db.commit()
