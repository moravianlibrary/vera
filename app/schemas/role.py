from typing import List

from pydantic import BaseModel

from definitions.permission import (
    GeneralPermission,
    OwnershipPermission,
    OwnershipScope,
)


# --------------------
# - Request Payloads -
# --------------------
class ScopedOwnershipPermission(BaseModel):
    permission: OwnershipPermission
    scope: OwnershipScope


class Permissions(BaseModel):
    general_permissions: List[GeneralPermission]
    ownership_permissions: List[ScopedOwnershipPermission]

    def get_scope(self, permission: OwnershipPermission) -> OwnershipScope:
        for p in self.ownership_permissions:
            if p.permission == permission:
                return p.scope
        raise ValueError(
            f"Ownership permission {permission} not found in permissions."
        )

    @classmethod
    def from_roles(cls, roles: List["Role"]) -> "Permissions":
        general_permissions = []
        ownership_permissions = []

        for role in roles:
            general_permissions.extend(role.general_permissions)
            ownership_permissions.extend(role.ownership_permissions)

        return cls(
            general_permissions=list(set(general_permissions)),
            ownership_permissions=list(set(ownership_permissions)),
        )


class RoleEdit(Permissions):
    name: str
    description: str | None = None
    permissions: Permissions


# -----------------
# - API Responses -
# -----------------
class Role(RoleEdit):
    class Config:
        from_attributes = True

    id: int
