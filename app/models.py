from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, TIMESTAMP, func
from sqlalchemy.orm import relationship

from database import Base

class Record(Base):
    __tablename__ = "board"

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)
    item_number = Column(String)

class User(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    password = Column(String)
    department = Column(String)

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("board.id"), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    note_text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)
