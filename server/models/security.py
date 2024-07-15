from typing import List
from sqlalchemy import (
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property

from schemas.types.action_type import ActionType
from schemas.security import DepartmentCreate, Department
from services.database import Base


class User(Base):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))

    department = relationship("Department", back_populates="department_users")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)

    role_actions = relationship("Action", back_populates="role")


class Action(Base):
    __tablename__ = "actions"

    role_id = Column(
        Integer, ForeignKey("roles.id"), primary_key=True, index=True
    )
    action = Column(Enum(ActionType), primary_key=True)

    role = relationship("Role", back_populates="role_actions")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String, unique=True)
    name = Column(String, unique=True)

    department_users = relationship("User", back_populates="department")

    @hybrid_property
    def users(self) -> List[str]:
        return [user.username for user in self.department_users]

    @classmethod
    def create_from_schema(
        cls, department_create: DepartmentCreate
    ) -> Department:
        department = cls(
            abbreviation=department_create.abbreviation,
            name=department_create.name,
        )
        for username in department_create.users:
            department.department_users.append(User(username=username))
        return department
