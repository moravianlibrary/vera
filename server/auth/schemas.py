from pydantic import BaseModel
from datetime import datetime
from typing import List
from roles.enums import ActionType
from users.schemas import User as UsersUser


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


class UserChangePassword(BaseModel):
    id: int
    password: str
    new_password: str


class CurrentUser(UserBase):
    actions: List[ActionType]


class User(UsersUser):
    pass
