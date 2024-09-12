from unittest.mock import patch
from services.external.aleph import MockAlephClient
from functools import wraps


def patch_aleph_client(func):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        mock_client = MockAlephClient()
        with patch(
            "services.external.aleph.AlephClient", return_value=mock_client
        ):
            return func(self, mock_client, *args, **kwargs)

    return wrapper
