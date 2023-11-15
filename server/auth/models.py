from sqlalchemy import Column, ForeignKey, Integer, String

from services.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    password = Column(String)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), index=True)
