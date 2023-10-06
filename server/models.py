from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, Text, TIMESTAMP, func
from sqlalchemy.orm import relationship

from enum import Enum as PythonEnum
from database import Base

class Role(PythonEnum):
    admin = "admin"
    insertor = "insertor"
    commentator = "commentator"
    editor = "editor"
    extractor = "extractor"


class Record(Base):
    __tablename__ = "board"

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)
    item_number = Column(String)

    category = Column(String)
    title = Column(String)
    pages_count = Column(Integer)

    signature = Column(String)
    issn = Column(String)
    isbn = Column(String)
    barcode = Column(String)

    creator_id = Column(String, ForeignKey("users.id"), index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    extractor_id = Column(String, ForeignKey("users.id"), index=True)
    extracted_at = Column(TIMESTAMP)


class RecordView(Record):
    __table__ = Table('board_with_usernames', Base.metadata, autoload=True, autoload_with=engine)
    creator = Column(User)
    extractor = Column(User)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    password = Column(String)
    department = Column(String)
    
    roles = relationship("UserRole", back_populates="user")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True, index=True)
    user_role = Column(Enum(Role), primary_key=True)

    user = relationship("User", back_populates="roles")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("board.id"), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    note_text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)
