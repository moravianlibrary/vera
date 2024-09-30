from typing import Generator, Any, Callable
from exceptions import IndexIsNotAvailableException
from functools import wraps
from elasticsearch import Elasticsearch
from config import VeraConfig
import requests
from requests.exceptions import RequestException


def is_indexer_available() -> bool:
    try:
        response = requests.get(VeraConfig.ElasticsearchUrl)
        if response.status_code not in [200, 401]:
            return False
    except RequestException:
        return False
    try:
        return Elasticsearch(
            VeraConfig.ElasticsearchUrl,
            basic_auth=(
                VeraConfig.ElasticsearchUsername,
                VeraConfig.ElasticsearchPassword,
            ),
        ).ping()
    except Exception:
        return False


def get_es_session() -> Generator["Elasticsearch", None, None]:
    if not is_indexer_available():
        raise IndexIsNotAvailableException()
    session = Elasticsearch(
        hosts=VeraConfig.Elasticsearch.Url,
        basic_auth=(
            VeraConfig.Elasticsearch.Username,
            VeraConfig.Elasticsearch.Password,
        ),
        timeout=VeraConfig.RequestTimeout,
    )
    try:
        yield session
    finally:
        session.close()


def with_es_session(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        if not is_indexer_available():
            raise IndexIsNotAvailableException()

        es_session = Elasticsearch(
            hosts=VeraConfig.Elasticsearch.Url,
            basic_auth=(
                VeraConfig.Elasticsearch.Username,
                VeraConfig.Elasticsearch.Password,
            ),
            timeout=VeraConfig.RequestTimeout,
        )

        try:
            return func(es_session, *args, **kwargs)
        finally:
            es_session.close()

    return wrapper
