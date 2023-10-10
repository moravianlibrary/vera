from pydantic import BaseModel
from typing import List, Optional, Set
from datetime import datetime
from models import Role
from etypes import ActionType, ActionScope


class Action(BaseModel):
    action_type: ActionType
    action_scope: ActionScope


class RoleBase(BaseModel):
    name: str


class RoleView(RoleBase):
    id: int
    actions: List[Action]


class DepartmentBase(BaseModel):
    abbreviation: str
    name: str


class Department(DepartmentBase):
    id: int


class Token(BaseModel):
    access_token: str
    token_type: str


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
    department_id: Optional[int]
    role_id: Optional[int]

    class Config:
        from_attributes = True


class UserView(User):
    department: Optional[Department]
    role: Optional[RoleView]


class UsersResponse(BaseModel):
    users: List[UserView]
    num_found: int


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
    category_id: int


class Record(RecordCreate):
    id: int

    creator: str
    created_at: datetime

    extraction_id: Optional[int]
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