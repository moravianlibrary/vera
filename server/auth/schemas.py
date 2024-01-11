from pydantic import BaseModel, Field
from typing import List, Optional
from roles.enums import ActionType


class TokenResponse(BaseModel):
    token_type: str
    access_token: str
    expires_in: int
    refresh_token: str
    refresh_expires_in: int
    session_state: str
    scope: str
    not_before_policy: int = Field(alias="not-before-policy")


class CurrentUser(BaseModel):
    username: str
    department_id: Optional[int]
    department_name: Optional[str]
    role_id: int
    role_name: str
    actions: List[ActionType]
