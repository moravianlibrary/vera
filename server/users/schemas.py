from pydantic import BaseModel
from typing import List, Optional


class User(BaseModel):
    id: int
    username: str
    department_id: Optional[int] = None
    role_id: Optional[int] = None

    department_abbreviation: Optional[str] = None
    department_name: Optional[str] = None
    role_name: Optional[str] = None


class UsersResponse(BaseModel):
    users: List[User]
    num_found: int
