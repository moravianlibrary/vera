from typing import List

from pydantic import BaseModel


class GroupEdit(BaseModel):
    name: str
    description: str | None = None


class Group(GroupEdit):
    id: int
    usernames: List[str]

    class Config:
        from_attributes = True


class GroupSummary(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
