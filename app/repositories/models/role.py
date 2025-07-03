from typing import List

from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property

from adapters.database import BaseModel
from definitions.permission import GeneralPermission
from schemas.role import ScopedOwnershipPermission


class RoleModel(BaseModel):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    _general_permissions = Column(
        JSONB, default=list, nullable=False, key="general_permissions"
    )
    _ownership_permissions = Column(
        JSONB, default=list, nullable=False, key="ownership_permissions"
    )

    @hybrid_property
    def general_permissions(self) -> List[GeneralPermission]:
        return [
            GeneralPermission(permission)
            for permission in self._general_permissions
        ]

    @general_permissions.setter
    def general_permissions(self, value: List[GeneralPermission]) -> None:
        self._general_permissions = [permission.value for permission in value]

    @hybrid_property
    def ownership_permissions(self) -> List[ScopedOwnershipPermission]:
        return [
            ScopedOwnershipPermission(**permission)
            for permission in self._ownership_permissions
        ]

    @ownership_permissions.setter
    def ownership_permissions(
        self, value: List[ScopedOwnershipPermission]
    ) -> None:
        self._ownership_permissions = [
            {
                "permission": permission.permission.value,
                "scope": permission.scope.value,
            }
            for permission in value
        ]
