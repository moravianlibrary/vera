from sqlalchemy import Column, Integer, String

from services.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String)
    name = Column(String)
