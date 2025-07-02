from typing import Dict, List

from sqlalchemy import Column, Integer, String, asc
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Query, Session, relationship

from .base import BaseModel
from .users import User


class Department(BaseModel):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    abbreviation = Column(String, unique=True, nullable=False)
    name = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="department")
    categories = relationship(
        "CategoryDepartments", back_populates="department"
    )

    @hybrid_property
    def usernames(self) -> List[str]:
        return [user.username for user in self.users]

    @classmethod
    def query_base(cls, session: Session) -> Query:
        return session.query(cls).order_by(asc(cls.name))

    def save_users(
        self, session: Session, usernames: List[str]
    ) -> "Department":
        actual_users_map: Dict[str, User] = {
            user.username: user for user in self.users
        }
        old_usernames = set(actual_users_map.keys())
        new_usernames = set(usernames)

        for username in old_usernames - new_usernames:
            actual_users_map[username].department_id = None

        for username in new_usernames - old_usernames:
            user = User.find(session, username)
            if user is None:
                user = User(username=username)
                session.add(user)
            user.department_id = self.id

        session.commit()
        return self
