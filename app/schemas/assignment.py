from typing import List, Optional

from pydantic import BaseModel


class Assignment(BaseModel):
    group_ids: List[int] = []
    user_ids: List[str] = []


class AssignmentChange(BaseModel):
    add: Optional[Assignment] = None
    remove: Optional[Assignment] = None
