from pydantic import BaseModel
from typing import List, Optional, Set
from datetime import datetime
from models import Role
from etypes import ActionType


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    actions: List[ActionType]


class Role(RoleBase):
    id: int


class RoleActions(Role):
    actions: List[ActionType]


class RolesResponse(BaseModel):
    roles: List[Role]


class RolesActionsResponse(BaseModel):
    roles: List[RoleActions]


class DepartmentBase(BaseModel):
    abbreviation: str
    name: str


class Department(DepartmentBase):
    id: int


class DepartmentsResponse(BaseModel):
    departments: List[Department]


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
    department_id: Optional[int] = None
    role_id: Optional[int] = None

    class Config:
        from_attributes = True


class UserEnlistment(User):
    department_abbreviation: Optional[str] = None
    department_name: Optional[str] = None
    role_name: Optional[str] = None


class UsersResponse(BaseModel):
    users: List[UserEnlistment]
    num_found: int


class CategoryBase(BaseModel):
    name: str


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int


class RecordBase(BaseModel):
    sysno: str
    volume_number: Optional[str] = None
    item_number: Optional[str] = None


class RecordPreCreate(RecordBase):
    title: str
    pages_count: Optional[int] = None

    signature: Optional[str] = None
    issn: Optional[str] = None
    isbn: Optional[str] = None
    barcode: Optional[str] = None


class RecordCreate(RecordPreCreate):
    category_id: int

    @classmethod
    def from_record_precreate(cls, record_precreate: RecordPreCreate, category_id: int) -> "RecordCreate":
        return cls(
            sysno=record_precreate.sysno,
            volume_number=record_precreate.volume_number,
            item_number=record_precreate.item_number,
            title=record_precreate.title,
            pages_count=record_precreate.pages_count,
            signature=record_precreate.signature,
            issn=record_precreate.issn,
            isbn=record_precreate.isbn,
            barcode=record_precreate.barcode,
            category_id=category_id
        )


class Record(RecordCreate):
    id: int

    creator_id: int
    created_at: datetime

    extraction_id: Optional[int]


class RecordView(Record):
    category_name: str

    creator: str

    extractor_id: Optional[int] = None
    extractor: Optional[str] = None
    extracted_at: Optional[datetime] = None

    comments_count: int

    class Config:
        arbitrary_types_allowed=True
        from_attributes = True


class RecordsResponse(BaseModel):
    records: List[RecordView]
    num_found: int


class Identifier(BaseModel):
    identifier_type: str
    value: str


class CommentBase(BaseModel):
    text: str


class CommentCreate(CommentBase):
    pass


class Comment(CommentBase):
    id: int
    record_id: int
    user_id: int
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed=True
        from_attributes = True


class ExtractionBase(BaseModel):
    pass


class ExtractionCreate(ExtractionBase):
    extracted_records: List[int]


class Extraction(ExtractionBase):
    id: int
    extractor_id: int
    extracted_at: datetime
