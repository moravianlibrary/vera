import logging
from functools import wraps
from typing import Any, Callable, Generator

import requests
from elasticsearch import Elasticsearch
from requests.exceptions import RequestException

from config import VeraConfig
from exceptions import IndexIsNotAvailableException

logger = logging.getLogger("uvicorn")


def is_indexer_available() -> bool:
    try:
        response = requests.get(VeraConfig.ElasticsearchUrl)
        logger.debug(
            f"HTTP GET {VeraConfig.ElasticsearchUrl} "
            f"returned status code {response.status_code}"
        )
        if response.status_code not in [200, 401]:
            logger.warning(
                "Elasticsearch endpoint responded with unexpected status code."
            )
            return False
    except RequestException as e:
        logger.error(f"Failed to reach Elasticsearch HTTP endpoint: {e}")
        return False

    try:
        es = Elasticsearch(
            VeraConfig.ElasticsearchUrl,
            basic_auth=(
                VeraConfig.ElasticsearchUsername,
                VeraConfig.ElasticsearchPassword,
            ),
        )
        if es.ping():
            logger.debug("Successfully pinged Elasticsearch.")
            return True
        else:
            logger.warning("Elasticsearch ping returned False.")
            es_info = es.info()
            logger.warning(f"Elasticsearch info: {es_info}")
            return False
    except Exception as e:
        logger.error(f"Exception occurred while pinging Elasticsearch: {e}")
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
