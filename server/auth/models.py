from sqlalchemy import Column, String
from services.database import Base


class Users(Base):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
