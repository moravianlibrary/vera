from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, Table, Text, TIMESTAMP, func
from sqlalchemy.orm import relationship

from database import Base
from etypes import ActionType, ActionScope


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)


class Action(Base):
    __tablename__ = "actions"

    role_id = Column(Integer, ForeignKey('roles.id'), primary_key=True, index=True)
    action_type = Column(Enum(ActionType), primary_key=True, index=True)
    actions_scope = Column(Enum(ActionScope))


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String)
    name = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    password = Column(String)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), index=True)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    extractor_id = Column(String, ForeignKey("users.id"), index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)
    item_number = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    title = Column(String)
    pages_count = Column(Integer)

    signature = Column(String)
    issn = Column(String)
    isbn = Column(String)
    barcode = Column(String)

    creator_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)


class RecordView(Base):
    __tablename__ = 'board_with_usernames'

    id = Column(Integer, ForeignKey('board.id'), primary_key=True, index=True)
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

    creator = Column(String, ForeignKey("users.username"))
    created_at = Column(TIMESTAMP, server_default=func.now())

    extractor = Column(String, ForeignKey("users.username"))
    extracted_at = Column(TIMESTAMP)
