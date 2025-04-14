from sqlalchemy import (
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from adapters.database import BaseModel
from custom_types import OwnershipPermission, OwnershipScope, Permission


class RoleModel(BaseModel):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    permissions = relationship(
        "RolePermissionModel", back_populates="role", lazy="joined"
    )
    ownership_permissions = relationship(
        "RoleOwnershipPermissionModel", back_populates="role", lazy="joined"
    )


class RolePermissionModel(BaseModel):
    __tablename__ = "role_permissions"

    role_id = Column(ForeignKey("roles.id"), nullable=False)
    permission = Column(Enum(Permission), nullable=False)

    role = relationship(
        "RoleModel", back_populates="permissions", lazy="joined"
    )

    __table_args__ = (UniqueConstraint("role_id", "permission"),)


class RoleOwnershipPermissionModel(BaseModel):
    __tablename__ = "role_ownership_permissions"

    role_id = Column(ForeignKey("roles.id"), nullable=False)
    permission = Column(Enum(OwnershipPermission), nullable=False)
    scope = Column(Enum(OwnershipScope), nullable=False)

    role = relationship(
        "RoleModel", back_populates="ownership_permissions", lazy="joined"
    )

    __table_args__ = (UniqueConstraint("role_id", "permission"),)
