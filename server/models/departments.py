from typing import List, Optional
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from schemas.security import DepartmentCreate, Department
from .users import User
from services.database import Base


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

    @classmethod
    def find(
        cls, session: Session, department_id: int
    ) -> Optional["Department"]:
        return session.query(cls).filter_by(id=department_id).first()

    @classmethod
    def get(cls, session: Session, department_id: int) -> "Department":
        department = cls.find(session, department_id)
        if department is None:
            raise ValueError(f"Department with id {department_id} not found")
        return department

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Department"]:
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
