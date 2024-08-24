from datatypes import ActionType
from typing import Dict, List


emulated_users: Dict[str, List[ActionType]] = {}


def can_emulate_access(user: CurrentUser):
    return (
        ActionType.EditAccess in user.actions
        or user.username in emulated_users
    )


def emulate_access(username: str, actions: List[ActionType]) -> List[ActionType]:
    emulated_actions = actions + [ActionType.StopEmulatingAccess]
    emulated_users[username] = emulated_actions
    return emulated_actions


def stop_emulating_access(username: str):
    if username in emulated_users:
        emulated_users.pop(username)
