from unittest.mock import patch, MagicMock
from services.external.aleph import MockAlephClient
from services.external.digitization_registry import (
    MockDigitizationRegistryClient,
)
from functools import wraps


def patch_aleph_client(target):
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            mock_aleph_client = MockAlephClient()
            mock_aleph_client_class = MagicMock()
            mock_aleph_client_class.return_value = mock_aleph_client
            with patch(target=target, return_value=mock_aleph_client_class):
                return func(self, mock_aleph_client, *args, **kwargs)

        return wrapper

    return decorator


def patch_digitization_registry_client(target):
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            mock_digitization_registry_client = (
                MockDigitizationRegistryClient()
            )
            mock_digitization_registry_class = MagicMock()
            mock_digitization_registry_class.return_value = (
                mock_digitization_registry_client
            )
            with patch(
                target=target, return_value=mock_digitization_registry_class
            ):
                return func(
                    self, mock_digitization_registry_client, *args, **kwargs
                )

        return wrapper

    return decorator
