from sqlalchemy import (
    ARRAY,
    Column,
    Integer,
    String,
)

from services.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String, unique=True)
    name = Column(String, unique=True)
    users = Column(ARRAY(String), default=[])
