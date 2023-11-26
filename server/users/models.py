from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import Session

from services.database import Base
from departments.models import Department
from roles.models import Role


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    password = Column(String)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), index=True)


def user_view(db: Session):
    return db.query(
        User.id,
        User.username,
        User.department_id,
        Department.abbreviation.label('department_abbreviation'),
        Department.name.label('department_name'),
        User.role_id,
        Role.name.label('role_name')
    ).join(
        Department, User.department_id == Department.id, isouter=True
    ).join(
        Role, User.role_id == Role.id, isouter=True
    )
