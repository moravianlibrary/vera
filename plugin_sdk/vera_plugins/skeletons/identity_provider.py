from abc import abstractmethod
from typing import List

from vera_plugins.specs.identity_provider import (
    IdentityProviderError,
    IdentityProviderPlugin,
    InvalidTokenError,
    UserFieldMissingError,
    UserInfo,
    UserInfoExtractionError,
)


class Skeleton(IdentityProviderPlugin):
    """
    Skeleton for identity provider plugins.

    This class defines the functionality for extracting user identity and roles
    from authentication tokens.

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
    """

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        raise NotImplementedError(
            "Implement the availability check logic here."
        )

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
        raise NotImplementedError(
            "Implement the user info extraction logic here."
        )

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
        raise NotImplementedError(
            "Implement the user ID retrieval logic here."
        )

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
        raise NotImplementedError(
            "Implement the username retrieval logic here."
        )

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
        raise NotImplementedError(
            "Implement the user roles retrieval logic here."
        )
