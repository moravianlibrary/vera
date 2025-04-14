from typing import Dict, List

from datatypes import ActionType
from schemas import AuthenticatedUser

# Stores temporarily assigned actions for emulated users
_emulated_users: Dict[str, List[ActionType]] = {}


def is_emulation_allowed(user: AuthenticatedUser) -> bool:
    """
    Check if the current user is allowed to emulate access.

    Parameters
    ----------
    user : AuthenticatedUser
        The user whose permissions should be checked.

    Returns
    -------
    bool
        True if the user has the EditAccess action
        or is already emulating actions.
    """
    return (
        ActionType.EditAccess in user.actions
        or user.username in _emulated_users
    )


def emulate_user_access(
    username: str, actions_to_emulate: List[ActionType]
) -> List[ActionType]:
    """
    Start emulating access for a user by assigning a list of actions.

    Parameters
    ----------
    username : str
        The username for which to emulate access.
    actions_to_emulate : List[ActionType]
        The list of actions to assign during emulation.

    Returns
    -------
    List[ActionType]
        The full list of emulated actions,
        including the `EmulateAccess` marker.
    """
    emulated_actions = actions_to_emulate + [ActionType.EmulateAccess]
    _emulated_users[username] = emulated_actions
    return emulated_actions


def clear_emulated_access(username: str) -> None:
    """
    Stop emulating access for a user
    by removing them from the emulation registry.

    Parameters
    ----------
    username : str
        The username whose emulated access should be cleared.

    Returns
    -------
    None
    """
    _emulated_users.pop(username, None)


def is_user_emulated(username: str) -> bool:
    """
    Check if a user is currently being emulated.

    Parameters
    ----------
    username : str

    Returns
    -------
    bool
        True if the user has emulated actions assigned.
    """
    return username in _emulated_users


def get_emulated_actions(username: str) -> List[ActionType]:
    """
    Get the emulated actions for a given user.

    Parameters
    ----------
    username : str

    Returns
    -------
    List[ActionType]
        The list of emulated actions, or an empty list if not emulated.
    """
    return _emulated_users.get(username, [])
