from pydantic import BaseModel
from typing import List, Optional


class UserBase(BaseModel):
    username: str
    department_id: Optional[int] = None
    role_id: Optional[int] = None


class UserUpdate(UserBase):
    pass


class User(UserBase):
    id: int

    department_abbreviation: Optional[str] = None
    department_name: Optional[str] = None
    role_name: Optional[str] = None


class UsersResponse(BaseModel):
    users: List[User]
    num_found: int
