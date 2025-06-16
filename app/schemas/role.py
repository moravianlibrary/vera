from typing import List, Tuple

from pydantic import BaseModel

from custom_types import GeneralPermission, OwnershipPermission, OwnershipScope

GeneralPermissions = List[GeneralPermission]
OwnershipPermissions = List[Tuple[OwnershipPermission, OwnershipScope]]


class Permissions(BaseModel):
    general_permissions: GeneralPermissions
    ownership_permissions: OwnershipPermissions

    def get_scope(self, permission: OwnershipPermission) -> OwnershipScope:
        for perm, scope in self.ownership_permissions:
            if perm == permission:
                return scope
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


class Role(RoleEdit):
    class Config:
        from_attributes = True

    id: int
