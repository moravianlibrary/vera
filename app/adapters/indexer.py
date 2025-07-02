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
    Optional,
    Type,
    TypeVar,
    get_origin,
    get_type_hints,
)

import requests
from elasticsearch import Elasticsearch
from esorm import es
from fastapi import HTTPException, status
from pydantic import BaseModel
from requests.exceptions import RequestException
from typing_extensions import Annotated, get_args

from config import VeraConfig

type IndexerSession = Elasticsearch


async def patch_es_meta():
    original_put_mapping = es.indices.put_mapping

    async def patched_put_mapping(*args, **kwargs):
        kwargs.setdefault("dynamic", "strict")
        kwargs.setdefault("meta", {"index.version": "1.0.0"})
        return await original_put_mapping(*args, **kwargs)

    es.indices.put_mapping = patched_put_mapping


EnumType = TypeVar("EnumType", bound=Enum)


class EnumList(Generic[EnumType]):
    __es_type__ = "keyword"

    def __init__(self, enum_cls: Type[EnumType]):
        self.enum_cls = enum_cls

    @classmethod
    def __class_getitem__(cls, enum_cls: Type[EnumType]):
        setattr(enum_cls, "__es_type__", cls.__es_type__)

        class Wrapper(list):
            __es_type__ = cls.__es_type__
            __enum_type__ = enum_cls

        Wrapper.__origin__ = list
        Wrapper.__args__ = (enum_cls,)

        return Wrapper


class IndexerDataType(str, Enum):
    str = "keyword"
    Text = "text"
    int = "int"
    Float = "float"
    bool = "boolean"
    Date = "date"


# --- Scalar types ---
str = Annotated[str, IndexerDataType.str]
Text = Annotated[str, IndexerDataType.Text]
int = Annotated[int, IndexerDataType.int]
Float = Annotated[float, IndexerDataType.Float]
bool = Annotated[bool, IndexerDataType.bool]
Date = Annotated[datetime, IndexerDataType.Date]

# --- Complex types ---
ESBaseModelType = TypeVar("ESBaseModelType", bound="ESBaseModel")
EnumType = TypeVar("EnumType", bound=Enum)
ItemType = str | Text | int | Float | bool | Date | ESBaseModelType


@dataclass
class ComplexMeta:
    item_type: ItemType


class Enumerate(Generic[EnumType]):
    def __class_getitem__(
        cls, enum_type: type[EnumType]
    ) -> Annotated[type[EnumType], IndexerDataType.str]:
        return Annotated[enum_type, IndexerDataType.str]


class Nullable(Generic[ESBaseModelType]):
    def __class_getitem__(
        cls, item_type: type["ESBaseModel"]
    ) -> Annotated[ESBaseModelType, ComplexMeta]:
        return Annotated[Optional[item_type], ComplexMeta(item_type)]


class Array(Generic[ESBaseModelType]):
    def __class_getitem__(
        cls, item_type: type["ESBaseModelType"]
    ) -> Annotated[List[ESBaseModelType], ComplexMeta]:
        return Annotated[List[item_type], ComplexMeta(item_type)]


# --- Base entity class ---
class ESBaseModel(BaseModel):
    __index_name__: str = "undefined"
    __id_field__: str = "id"
    __index_version__: str = "init"
    __dynamic__: str = "strict"

    @classmethod
    def field_schema(cls, annotated_type):
        origin = get_origin(annotated_type)
        args = get_args(annotated_type)

        if origin is Annotated and len(args) == 2:
            type_, meta = args

            if isinstance(type_, type) and issubclass(type_, ESBaseModel):
                return {
                    "type": "nested",
                    "properties": type_.object_schema(),
                }

            if isinstance(meta, IndexerDataType):
                return {"type": meta.value}

            if isinstance(meta, ComplexMeta):
                return cls.field_schema(meta.item_type)

            raise ValueError(f"Unsupported Annotated meta: {meta}")

        elif isinstance(annotated_type, type) and issubclass(
            annotated_type, ESBaseModel
        ):
            return {
                "type": "nested",
                "properties": annotated_type.object_schema(),
            }

        raise ValueError(
            "Invalid type (neither Annotated nor ESBaseModel): "
            f"{annotated_type}"
        )

    @classmethod
    def object_schema(cls) -> dict:
        props = {}
        hints = get_type_hints(cls, include_extras=True)

        for field_name, annotated_type in hints.items():
            if field_name.startswith("__"):
                continue
            props[field_name] = cls.field_schema(annotated_type)

        return props

    @classmethod
    def index_schema(cls) -> dict:
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


class Hit(BaseModel, Generic[ESBaseModelType]):
    _index: str
    _type: str | None
    _id: str
    _score: float | None
    _source: ESBaseModelType


class Hits(BaseModel, Generic[ESBaseModelType]):
    total: int | dict
    max_score: float | None
    hits: List[Hit[ESBaseModelType]]


class IndexerResponse(BaseModel, Generic[ESBaseModelType]):
    took: int
    timed_out: bool
    _shards: Dict[str, Any]
    hits: Hits[ESBaseModelType]


class IndexIsNotAvailableException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Elasticsearch index is not available "
            f"({VeraConfig.ElasticsearchUrl})",
        )


def _create_session() -> IndexerSession:
    return Elasticsearch(
        hosts=VeraConfig.ElasticsearchUrl,
        basic_auth=(
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
        ),
        timeout=VeraConfig.RequestTimeout,
    )


def is_indexer_available() -> bool:
    try:
        response = requests.get(VeraConfig.ElasticsearchUrl)
        if response.status_code not in [200, 401]:
            return False
    except RequestException:
        return False
    try:
        return _create_session().ping()
    except Exception:
        return False


def get_indexer_session() -> Generator[IndexerSession, None, None]:
    if not is_indexer_available():
        raise IndexIsNotAvailableException()
    session = _create_session()
    try:
        yield session
    finally:
        session.close()


def with_indexer_session(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        if not is_indexer_available():
            raise IndexIsNotAvailableException()

        session = _create_session()

        try:
            return func(session, *args, **kwargs)
        finally:
            session.close()

    return wrapper
