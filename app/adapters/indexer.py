from datetime import datetime
from enum import Enum
from functools import wraps
from typing import (
    Any,
    Callable,
    Dict,
    Generator,
    Generic,
    List,
    TypeVar,
    get_origin,
    get_type_hints,
)

import requests
from elasticsearch import Elasticsearch
from fastapi import HTTPException, status
from pydantic import BaseModel
from requests.exceptions import RequestException
from typing_extensions import Annotated, get_args

from config import VeraConfig

type IndexerSession = Elasticsearch


class EsDataType(str, Enum):
    Keyword = "keyword"
    Text = "text"
    Integer = "integer"
    Float = "float"
    Boolean = "boolean"
    Date = "date"


Keyword = Annotated[str, EsDataType.Keyword]
Text = Annotated[str, EsDataType.Text]
Integer = Annotated[int, EsDataType.Integer]
Float = Annotated[float, EsDataType.Float]
Boolean = Annotated[bool, EsDataType.Boolean]
Date = Annotated[datetime, EsDataType.Date]

T = TypeVar("T", bound=Enum)


class Enumerate(Generic[T]):
    def __class_getitem__(
        cls, item: type[T]
    ) -> Annotated[type[T], EsDataType.Keyword]:
        return Annotated[item, EsDataType.Keyword]


class IndexerEntity(BaseModel):
    __index_name__: str = "undefined"
    __id_field__: str = "id"
    __index_version__: str = "init"
    __dynamic__: str = "strict"

    @classmethod
    def es_schema(cls) -> dict:
        props = {}

        hints = get_type_hints(cls, include_extras=True)
        for field_name, annotated_type in hints.items():
            origin = get_origin(annotated_type)
            if origin is Annotated:
                _, es_type = get_args(annotated_type)
                if isinstance(es_type, EsDataType):
                    props[field_name] = {"type": es_type.value}

        return {
            "mappings": {
                "_meta": {"index.version": cls.__index_version__},
                "dynamic": cls.__dynamic__,
                "properties": props,
            }
        }


IndexerEntityType = TypeVar("IndexerEntityType", bound=IndexerEntity)


class IndexerQuery(BaseModel):
    bool: Dict[str, Any] | None = None
    match: Dict[str, Any] | None = None
    term: Dict[str, Any] | None = None


class IndexerRequest(BaseModel):
    query: IndexerQuery


class Hit(BaseModel, Generic[IndexerEntityType]):
    _index: str
    _type: str | None
    _id: str
    _score: float | None
    _source: IndexerEntityType


class Hits(BaseModel, Generic[IndexerEntityType]):
    total: int | dict
    max_score: float | None
    hits: List[Hit[IndexerEntityType]]


class IndexerResponse(BaseModel, Generic[IndexerEntityType]):
    took: int
    timed_out: bool
    _shards: Dict[str, Any]
    hits: Hits[IndexerEntityType]


class IndexIsNotAvailableException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Elasticsearch index is not available "
            f"({VeraConfig.ElasticsearchUrl})",
        )


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


def get_indexer_session() -> Generator[IndexerSession, None, None]:
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


def with_indexer_session(func: Callable) -> Callable:
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


def has_current_version_schema(
    index_name: str, index_version: str, indexer_session: IndexerSession
) -> bool:
    current_mapping = indexer_session.indices.get_mapping(
        index=index_name
    ).get(index_name, {})

    if not current_mapping:
        return False

    return (
        current_mapping.get("mappings", {})
        .get("_meta", {})
        .get("index.version", None)
        == index_version
    )


def recreate_index(
    index_name: str, schema: dict, indexer_session: IndexerSession
):
    if indexer_session.indices.exists(index=index_name):
        indexer_session.indices.delete(index=index_name)
    indexer_session.indices.create(index=index_name, body=schema)


def refresh_index(index_name: str, indexer_session: IndexerSession):
    indexer_session.indices.refresh(index=index_name)
