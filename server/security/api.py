from fastapi import Depends
from sqlalchemy.orm import Session
from security.keycloak_client import get_user_from_token, oauth2_scheme
from security.schemas import CurrentUser
from services.database import get_db
from security.types import ActionType
from typing import Dict, List


emulated_users: Dict[str, List[ActionType]] = {}


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    user = get_user_from_token(token, db)
    if user.username in emulated_users:
        user.actions = emulated_users[user.username]
    return user


def CallerUsername() -> CurrentUser:
    def get_caller_username(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> str:
        return current_user.username

    return Depends(get_caller_username)


def emulate_access(username: str, actions: List[ActionType]):
    emulated_users[username] = actions + [ActionType.StopEmulatingAccess]


def stop_emulating_access(username: str):
    emulated_users.pop(username)
