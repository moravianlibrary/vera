from unittest.mock import patch, MagicMock
from services.aleph import MockAlephClient
from services.external.digitization_registry import (
    MockDigitizationRegistryClient,
)
from functools import wraps


def patch_aleph_client(target):
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            mock_class = MagicMock()
            mock_class.return_value = MockAlephClient()
            with patch(target=target, return_value=mock_class):
                return func(self, mock_class.return_value, *args, **kwargs)

        return wrapper

    return decorator


def patch_digitization_registry_client(target):
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            mock_client = MockDigitizationRegistryClient()
            mock_class = MagicMock()
            mock_class.return_value = mock_client
            with patch(target=target, return_value=mock_class):
                return func(self, mock_client, *args, **kwargs)

        return wrapper

    return decorator
