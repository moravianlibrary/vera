from typing import List

from definitions.permission import (
    GeneralPermission,
    OwnershipPermission,
    PermissionType,
)

from .group import Group
from .role import Permissions, Role
from .user import UserAssignment


class AuthenticatedUser(Permissions):
    id: str
    username: str
    roles: List[Role]
    groups: List[Group]

    @property
    def group_ids(self) -> List[int]:
        return [group.id for group in self.groups]

    @property
    def group_users_ids(self) -> List[str]:
        return [user.id for group in self.groups for user in group.users]

    @property
    def assignment(self) -> UserAssignment:
        return UserAssignment(user_id=self.id, group_ids=self.group_ids)

    def has_permission(
        self,
        permission: PermissionType,
    ) -> bool:
        if isinstance(permission, GeneralPermission):
            return permission in self.general_permissions
        if isinstance(permission, OwnershipPermission):
            return any(permission == p for p in self.ownership_permissions)
        raise ValueError(f"Unknown permission type: {type(permission)}. ")
