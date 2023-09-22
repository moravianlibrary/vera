from pydantic import BaseModel
from typing import Optional
from sqlalchemy import TIMESTAMP


class RecordBase(BaseModel):
    sysno: str
    volume_number: Optional[str]
    item_number: Optional[str]

class RecordCreate(RecordBase):
    pass

class Record(RecordBase):
    id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class NoteBase(BaseModel):
    record_id: str
    user_id: str
    note_text: str


class NoteCreate(NoteBase):
    pass


class Note(NoteBase):
    id: int
    created_at: TIMESTAMP
    edited_at: Optional[TIMESTAMP]

    class Config:
        arbitrary_types_allowed=True
        from_attributes = True