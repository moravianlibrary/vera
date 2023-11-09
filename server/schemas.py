from pydantic import BaseModel
from typing import List, Optional, Set
from datetime import datetime
from models import Role
from enums import ActionType, MaterialType, IssuanceType


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
    expires_on: datetime


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


class CurrentUser(UserEnlistment):
    actions: List[ActionType]


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

    material_type: Optional[MaterialType]
    title: str
    publishers: Optional[List[str]] = None

    pages_count: Optional[int] = None
    size: Optional[str] = None
    
    signature: Optional[str] = None
    barcode: Optional[str] = None
    ccnb: Optional[str] = None
    isbn: Optional[str] = None


class Issue(BaseModel):
    signature: Optional[str]
    year_issued: Optional[str]
    volume: Optional[str]
    item: Optional[str]
    barcode: Optional[str]
    issuance_type: IssuanceType


class RecordPrecreate(RecordBase):
    periodicity: Optional[str] = None
    publishing_date: Optional[str] = None
    issues: List[Issue]


class RecordCreate(RecordBase):
    category_id: int

    @classmethod
    def from_record_precreate(cls, record_precreate: RecordPrecreate, category_id: int) -> "RecordCreate":
        return cls(
            sysno=record_precreate.sysno,
            volume_number=record_precreate.volume_number,
            item_number=record_precreate.item_number,
            material_type=record_precreate.material_type,
            title=record_precreate.title,
            publishers=record_precreate.publishers,
            pages_count=record_precreate.pages_count,
            size=record_precreate.size,
            signature=record_precreate.signature,
            barcode=record_precreate.barcode,
            ccnb=record_precreate.ccnb,
            isbn=record_precreate.isbn,
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
    creator_department_id: Optional[int]

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
