from functools import wraps
from typing import Type
from unittest.mock import MagicMock

from repositories._base import BaseRepository


def mock_repository(repository_class: Type[BaseRepository]):
    """
    Decorator for injecting a mocked repository into a test function.
    Usage:
        @mock_repository(MyRepository, indexer_entity=MyIndexerNestedModel)
        def test_something(mock_repo):
            ...
    """

    def decorator(test_func):
        @wraps(test_func)
        def wrapper(self, *args, **kwargs):
            repository = repository_class(
                MagicMock(name="database_session"),
                MagicMock(name="indexer_session"),
            )

            return test_func(self, repository, *args, **kwargs)

        return wrapper

    return decorator
