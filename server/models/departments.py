from typing import Dict, List
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from .base import BaseMixin
from .users import User


class Department(Base, BaseMixin):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String, unique=True, nullable=False)
    name = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="department")

    @hybrid_property
    def usernames(self) -> List[str]:
        return [user.username for user in self.users]

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
