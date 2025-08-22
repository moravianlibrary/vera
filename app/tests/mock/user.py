from pydantic import model_validator

from definitions.permission import OwnershipScope
from schemas.authenticated_user import AuthenticatedUser


class SuperUser(AuthenticatedUser):
    def has_permission(self, permission):
        return True

    def get_scope(self, permission):
        return OwnershipScope.Global

    @model_validator(mode="before")
    def validate_super_user(cls, values):
        values["id"] = values.get("id", "superuser")
        values["username"] = values.get("username", "superuser")
        values["email"] = values.get("email", "superuser@mzk.cz")
        values["roles"] = values.get("roles", [])
        values["groups"] = values.get("groups", [])
        values["general_permissions"] = values.get("general_permissions", [])
        values["ownership_permissions"] = values.get(
            "ownership_permissions", []
        )
        return values
