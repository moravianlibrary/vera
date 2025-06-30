from typing import Dict

from fastapi.security import OAuth2PasswordBearer
from vera_plugins.tools.registry import PluginRegistry

from definitions.permission import GeneralPermission
from repositories.role import RoleRepository
from repositories.user import UserRepository
from schemas.common import Page
from schemas.role import Permissions
from schemas.user import AuthenticatedUser, User

AuthScheme = OAuth2PasswordBearer(tokenUrl="auth/token")


class IdentityProvider:
    """
    Identity and permission management service.

    Handles user authentication and permission emulation using an external
    identity provider plugin.

    Parameters
    ----------
    plugin_registry : PluginRegistry
        The plugin registry providing the identity provider plugin.
    """

    def __init__(self, plugin_registry: PluginRegistry):
        self._ip = plugin_registry.identity_provider
        self._emulated_permissions: Dict[str, Permissions] = {}

    def authenticate_user(
        self,
        token: str,
        user_repository: UserRepository,
        role_repository: RoleRepository,
    ) -> AuthenticatedUser:
        """
        Authenticate a user and resolve their permissions.

        Parameters
        ----------
        token : str
            The access token used to identify the user.
        user_repository : UserRepository
            Repository interface for user persistence.
        role_repository : RoleRepository
            Repository interface for resolving user roles.

        Returns
        -------
        AuthenticatedUser
            The authenticated user enriched with roles and permissions.
        """
        user_info = self._ip.extract_user_info(token)

        user_id = self._ip.get_user_id(user_info)
        username = self._ip.get_username(user_info)
        user_roles = self._ip.get_user_roles(user_info)

        user = user_repository.find_by_id(user_id)
        if user is None:
            user = user_repository.create(user_id, username)

        roles = role_repository.find_by_names(user_roles)

        permissions = (
            self._emulated_permissions[user_id]
            if user_id in self._emulated_permissions
            else Permissions.from_roles(roles)
        )

        return AuthenticatedUser(
            user_id=user_id,
            username=username,
            roles=roles,
            general_permissions=permissions.general_permissions,
            ownership_permissions=permissions.ownership_permissions,
        )

    def enable_emulated_permissions(
        self, user: AuthenticatedUser, permissions: Permissions
    ) -> AuthenticatedUser:
        """
        Emulate permissions for a given user.

        Ensures the `EmulateAccess` permission is present, allowing the user
        to revert to their original access.

        Parameters
        ----------
        user : AuthenticatedUser
            The user for whom to emulate permissions.
        permissions : Permissions
            The permissions to emulate.

        Returns
        -------
        AuthenticatedUser
            The updated user with emulated permissions applied.
        """
        if (
            GeneralPermission.EmulateAccess
            not in permissions.general_permissions
        ):
            permissions.general_permissions.append(
                GeneralPermission.EmulateAccess
            )

        self._emulated_permissions[user.id] = permissions
        user.general_permissions = permissions.general_permissions
        user.ownership_permissions = permissions.ownership_permissions

        return user

    def disable_emulated_permissions(
        self, user: AuthenticatedUser
    ) -> AuthenticatedUser:
        """
        Revert any emulated permissions for a user.

        Removes the user from the emulation registry and restores permissions
        based on their roles.

        Parameters
        ----------
        user : AuthenticatedUser
            The user whose emulated permissions should be removed.

        Returns
        -------
        AuthenticatedUser
            The updated user with original, role-based permissions restored.
        """
        self._emulated_permissions.pop(user.id, None)

        original_permissions = Permissions.from_roles(user.roles)
        user.general_permissions = original_permissions.general_permissions
        user.ownership_permissions = original_permissions.ownership_permissions

        return user

    def paginate_users(
        self,
        username: str | None,
        page: int,
        page_size: int,
    ) -> Page[User]:
        """
        Paginate users from the identity provider.

        Parameters
        ----------
        username : str | None
            Optional filter for usernames.
        page : int
            The page number to retrieve.
        page_size : int
            The number of users per page.

        Returns
        -------
        Page[User]
            A paginated list of users from the identity provider.
        """
        pass
        # return self._ip.paginate_users(username, page, page_size)

    def paginate_roles(
        self,
        role_name: str | None,
        page: int,
        page_size: int,
    ) -> Page[User]:
        """
        Paginate roles from the identity provider.

        Parameters
        ----------
        role_name : str | None
            Optional filter for role names.
        page : int
            The page number to retrieve.
        page_size : int
            The number of roles per page.

        Returns
        -------
        Page[User]
            A paginated list of roles from the identity provider.
        """
        pass
        # return self._ip.paginate_roles(role_name, page, page_size)
