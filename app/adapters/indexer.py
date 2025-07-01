from dataclasses import dataclass
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


# --- Scalar types ---
Keyword = Annotated[str, EsDataType.Keyword]
Text = Annotated[str, EsDataType.Text]
Integer = Annotated[int, EsDataType.Integer]
Float = Annotated[float, EsDataType.Float]
Boolean = Annotated[bool, EsDataType.Boolean]
Date = Annotated[datetime, EsDataType.Date]

EnumType = TypeVar("EnumType", bound=Enum)


class Enumerate(Generic[EnumType]):
    def __class_getitem__(
        cls, item: type[EnumType]
    ) -> Annotated[type[EnumType], EsDataType.Keyword]:
        return Annotated[item, EsDataType.Keyword]


# --- Complex types metadata ---
@dataclass
class ObjectMeta:
    model: type["IndexerEntity"]


@dataclass
class ArrayMeta:
    item_type: Any


# --- Complex types ---
IndexerEntityType = TypeVar("IndexerEntityType", bound="IndexerEntity")


class Object(Generic[IndexerEntityType]):
    def __class_getitem__(
        cls, item: type["IndexerEntity"]
    ) -> Annotated[IndexerEntityType, ObjectMeta]:
        return Annotated[item, ObjectMeta(item)]


ArrayType = TypeVar("ArrayType")


class Array(Generic[ArrayType]):
    def __class_getitem__(
        cls, item: Any
    ) -> Annotated[List[ArrayType], ArrayMeta]:
        return Annotated[List[item], ArrayMeta(item)]


# --- Base entity class ---
class IndexerEntity(BaseModel):
    __index_name__: str = "undefined"
    __id_field__: str = "id"
    __index_version__: str = "init"
    __dynamic__: str = "strict"

    @classmethod
    def field_schema(cls, annotated_type):
        origin = get_origin(annotated_type)
        args = get_args(annotated_type)

        if origin is Annotated and len(args) == 2:
            _, meta = args

            if isinstance(meta, EsDataType):
                return {"type": meta.value}

            elif isinstance(meta, ObjectMeta):
                return {
                    "type": "nested",
                    "properties": meta.model.object_schema(),
                }

            elif isinstance(meta, ArrayMeta):
                return cls.field_schema(meta.item_type)

    @classmethod
    def object_schema(cls) -> dict:
        props = {}
        hints = get_type_hints(cls, include_extras=True)

        for field_name, annotated_type in hints.items():
            cls.field_schema(props, field_name, annotated_type)

        return props

    @classmethod
    def es_schema(cls) -> dict:
        return {
            "mappings": {
                "_meta": {"index.version": cls.__index_version__},
                "dynamic": cls.__dynamic__,
                "properties": cls.object_schema(),
            }
        }


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
