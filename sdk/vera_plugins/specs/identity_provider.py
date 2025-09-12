from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Generic, List, TypeVar

from .base import ExternalResourceMixin, PluginBase

UserInfo = Dict[str, Any]


@dataclass
class UserSummary:
    id: str
    username: str
    email: str


@dataclass
class RoleSummary:
    name: str


T = TypeVar("T")


@dataclass
class Page(Generic[T]):
    items: List[T]
    total: int


class IdentityProviderError(Exception):
    """
    Base class for all identity provider errors.

    This serves as the root exception for all custom exceptions
    raised by identity provider plugins.
    """

    pass


class InvalidTokenError(IdentityProviderError):
    """
    Raised when the provided token is invalid or expired.

    This exception is typically raised when the token fails verification,
    is malformed, or has expired according to the issuing authority.
    """

    pass


class UserInfoExtractionError(IdentityProviderError):
    """
    Raised when user information cannot be extracted from the token.

    This may occur due to malformed token payloads, decoding failures,
    or missing expected structures within the token.
    """

    pass


class UserFieldMissingError(IdentityProviderError):
    """
    Raised when an expected field is missing from the extracted user
    information.

    Parameters
    ----------
    field : str
        The name of the missing field in the user information dictionary.
    """

    def __init__(self, field: str):
        super().__init__(f"Missing required field in user info: '{field}'")
        self.field = field


class IdentityProviderPlugin(PluginBase, ExternalResourceMixin):
    """
    Abstract interface for identity provider plugins.

    This interface defines the contract for plugins that extract user identity
    and roles from authentication tokens. It separates token parsing,
    identity resolution, and role extraction to allow for custom
    authentication mechanisms.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    extract_user_info(token: str) -> UserInfo
        Extract user information from the provided authentication token.

    get_user_id(user_info: UserInfo) -> str
        Retrieve the user ID from the extracted user information.

    get_username(user_info: UserInfo) -> str
        Retrieve the username from the extracted user information.

    get_user_roles(user_info: UserInfo) -> List[str]
        Retrieve the roles associated with the user from the extracted user
        information.

    paginate_users(page: int, per_page: int) -> List[UserSummary]
        Paginate through users from the identity provider.

    paginate_roles(page: int, per_page: int) -> List[RoleSummary]
        Paginate through roles from the identity provider.
    """

    @abstractmethod
    def extract_user_info(self, token: str) -> UserInfo:
        """
        Extract user information from the given authentication token.

        Parameters
        ----------
        token : str
            The raw authentication token provided by the client.

        Returns
        -------
        UserInfo
            A dictionary containing user information extracted from the token.

        Raises
        ------
        InvalidTokenError
            If the token is invalid, malformed, or expired.
        UserInfoExtractionError
            If user info could not be parsed or extracted.
        """
        pass

    @abstractmethod
    def get_user_id(self, user_info: UserInfo) -> str:
        """
        Retrieve the user's unique identifier from extracted user information.

        Parameters
        ----------
        user_info : UserInfo
            A dictionary containing user information.

        Returns
        -------
        str
            A string representing the unique user ID.

        Raises
        ------
        UserFieldMissingError
            If the user ID field is missing in the user info dictionary.
        """
        pass

    @abstractmethod
    def get_username(self, user_info: UserInfo) -> str:
        """
        Retrieve the user's display name or username.

        Parameters
        ----------
        user_info : UserInfo
            A dictionary containing user information.

        Returns
        -------
        str
            The username or display name of the user.

        Raises
        ------
        UserFieldMissingError
            If the username field is missing in the user info dictionary.
        """
        pass

    @abstractmethod
    def get_user_email(self, user_info: UserInfo) -> str:
        """
        Retrieve the user's email address from extracted user information.

        Parameters
        ----------
        user_info : UserInfo
            A dictionary containing user information.

        Returns
        -------
        str
            The email address of the user.

        Raises
        ------
        UserFieldMissingError
            If the email field is missing in the user info dictionary.
        """
        pass

    @abstractmethod
    def get_user_roles(self, user_info: UserInfo) -> List[str]:
        """
        Retrieve the list of roles or permissions assigned to the user.

        Parameters
        ----------
        user_info : UserInfo
            A dictionary containing user information.

        Returns
        -------
        List[str]
            A list of roles associated with the user.

        Raises
        ------
        UserFieldMissingError
            If the roles field is missing in the user info dictionary.
        """
        pass

    def paginate_users(
        self,
        page: int,
        per_page: int,
        filter: str | None,
    ) -> Page[UserSummary]:
        """
        Optional method to paginate through users from the identity provider.

        This method can be overridden by plugins that support user listing
        and pagination. The default implementation raises NotImplementedError.

        Parameters
        ----------
        page : int
            The page number to retrieve (1-based index).
        per_page : int
            The number of users to include per page.
        filter : str | None
            An optional filter string to apply to the user list
            (e.g., by username or email).

        Returns
        -------
        Page[UserSummary]
            A paginated list of user summaries for the requested page.

        Raises
        ------
        NotImplementedError
            If the plugin does not support user pagination.
        """
        raise NotImplementedError(
            "User pagination is not implemented for this plugin."
        )

    def paginate_roles(
        self, page: int, per_page: int, filter: str | None
    ) -> Page[RoleSummary]:
        """
        Optional method to paginate through roles from the identity provider.

        This method can be overridden by plugins that support role listing
        and pagination. The default implementation raises NotImplementedError.

        Parameters
        ----------
        page : int
            The page number to retrieve (1-based index).
        per_page : int
            The number of roles to include per page.
        filter : str | None
            An optional filter string to apply to the role list
            (e.g., by role name).

        Returns
        -------
        Page[RoleSummary]
            A paginated list of role summaries for the requested page.

        Raises
        ------
        NotImplementedError
            If the plugin does not support role pagination.
        """
        raise NotImplementedError(
            "Role pagination is not implemented for this plugin."
        )
