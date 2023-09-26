from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RecordBase(BaseModel):
    sysno: str
    volume_number: Optional[str]
    item_number: Optional[str]

class RecordCreate(RecordBase):
    pass

class Record(RecordBase):
    id: int

    category: str
    title: str
    pages_count: int

    signature: Optional[str]
    issn: Optional[str]
    isbn: Optional[str]
    barcode: Optional[str]

    creator: str
    created_at: datetime

    extractor: Optional[str]
    extracted_at: Optional[datetime]

    class Config:
        arbitrary_types_allowed=True
        from_attributes = True

class RecordsResponse(BaseModel):
    records: List[Record]
    num_found: int


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
    created_at: datetime
    edited_at: Optional[datetime]

    class Config:
        arbitrary_types_allowed=True
        from_attributes = True