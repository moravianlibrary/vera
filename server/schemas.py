from pydantic import BaseModel
from typing import List, Optional, Set
from datetime import datetime
from models import Role


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str


class UserLogin(UserCreate):
    pass


class UserChangePassword(UserCreate):
    new_password: str


class User(UserBase):
    id: int
    department: Optional[str]

    class Config:
        from_attributes = True


class UserRoles(User):
    roles: Set[Role]


class UsersResponse(BaseModel):
    users: List[UserRoles]
    num_found: int


class Token(BaseModel):
    access_token: str
    token_type: str


class RecordBase(BaseModel):
    sysno: str
    volume_number: Optional[str]
    item_number: Optional[str]


class RecordPreCreate(RecordBase):
    title: str
    pages_count: Optional[int]

    signature: Optional[str]
    issn: Optional[str]
    isbn: Optional[str]
    barcode: Optional[str]


class RecordCreate(RecordPreCreate):
    category: str


class Record(RecordBase):
    id: int

    category: str
    title: str
    pages_count: Optional[int]

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


class Identifier(BaseModel):
    identifier_type: str
    value: str


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