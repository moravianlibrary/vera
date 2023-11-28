from sqlalchemy import Boolean, Column, Integer, String
from services.database import Base


class Quota(Base):
    __tablename__ = "categories_quotas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    pages_count = Column(Integer)
    active = Column(Boolean)
