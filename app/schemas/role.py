from typing import List, Tuple

from pydantic import BaseModel

from custom_types import GeneralPermission, OwnershipPermission, OwnershipScope

GeneralPermissions = List[GeneralPermission]
OwnershipPermissions = List[Tuple[OwnershipPermission, OwnershipScope]]


class Permissions(BaseModel):
    general_permissions: GeneralPermissions
    ownership_permissions: OwnershipPermissions


class RoleEdit(Permissions):
    name: str
    description: str | None = None


class Role(RoleEdit):
    class Config:
        from_attributes = True

    id: int
