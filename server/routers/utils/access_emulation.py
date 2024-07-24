from datatypes import ActionType
from typing import Dict, List


emulated_users: Dict[str, List[ActionType]] = {}


def emulate_access(username: str, actions: List[ActionType]):
    emulated_users[username] = actions + [ActionType.StopEmulatingAccess]


def stop_emulating_access(username: str):
    if username in emulated_users:
        emulated_users.pop(username)
