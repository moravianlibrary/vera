from pydantic import BaseModel


class RecordBase(BaseModel):
    sysno: str
    volume_number: str | None
    item_number: str | None

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