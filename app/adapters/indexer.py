from enum import Enum
from functools import wraps
from typing import Callable, Dict, Generic, List, Type, TypeVar

from aiohttp import ClientSession
from elasticsearch import AsyncElasticsearch
from esorm import ESBaseModel, ESModel, aggs, es

# from esorm.query import ESQuery
from fastapi import HTTPException, status
from pydantic import BaseModel, Field

from config import config

IndexerSession = AsyncElasticsearch
IndexerModel = ESModel
IndexerNestedModel = ESBaseModel


class IndexerQuery(BaseModel):
    class Config:
        extra = "allow"


class IndexerRequest(IndexerQuery):
    pass


SourceType = TypeVar("SourceType")


class Hit(BaseModel, Generic[SourceType]):
    """
    Represents a single hit (result) from Elasticsearch.
    """

    index: str = Field(..., alias="_index")
    """ The index the hit is from. """
    id: str = Field(..., alias="_id")
    """ The id of the hit. """
    score: float | None = Field(..., alias="_score")
    """ The score of the hit. """
    source: SourceType = Field(..., alias="_source")
    """ The source of the hit. """

    class Config:
        populate_by_name = True


class HitsTotal(BaseModel):
    value: int
    relation: str


class Hits(BaseModel, Generic[SourceType]):
    """
    Represents the hits section of the Elasticsearch response.
    """

    total: int | HitsTotal
    """ The total number of hits. """
    max_score: float | None
    """ The maximum score of the hits. """
    hits: List[Hit[SourceType]]
    """ List of hits. """


class IndexerResponse(BaseModel, Generic[SourceType]):
    """
    Represents the overall structure of an Elasticsearch response.
    """

    took: int
    """ The time in milliseconds it took to execute the query. """
    timed_out: bool
    """ Whether the query timed out. """
    shards: Dict[str, int] = Field(..., alias="_shards")
    """ The number of shards the query was executed on. """
    hits: Hits[SourceType]
    """ The hits section of the response. """
    aggregations: aggs.ESAggsResponse | None = None
    """ The aggregations section of the response. """


IndexerModelType = TypeVar("IndexerModelType", bound=IndexerModel)


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


def _patch_es_meta():
    original_put_mapping = es.indices.put_mapping

    async def patched_put_mapping(*args, **kwargs):
        kwargs.setdefault("dynamic", "strict")
        kwargs.setdefault("meta", {"index.version": "1.0.0"})
        return await original_put_mapping(*args, **kwargs)

    es.indices.put_mapping = patched_put_mapping


async def connect():
    es.set_client(
        AsyncElasticsearch(
            hosts=config.elasticsearch.url,
            basic_auth=(
                config.elasticsearch.username,
                config.elasticsearch.password,
            ),
            request_timeout=config.elasticsearch.request_timeout,
        )
    )
    _patch_es_meta()


class IndexIsNotAvailableException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Elasticsearch index is not available "
            f"({config.elasticsearch.url})",
        )


async def is_indexer_available() -> bool:
    try:
        async with ClientSession() as session:
            async with session.get(config.elasticsearch.url) as resp:
                if resp.status not in [200, 401]:
                    return False
    except Exception:
        return False
    try:
        await connect()
        return await es.ping()
    except Exception:
        return False


async def get_indexer_session():
    if not await is_indexer_available():
        raise IndexIsNotAvailableException()
    try:
        yield es
    finally:
        await es.close()


def with_indexer_session(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not await is_indexer_available():
            raise IndexIsNotAvailableException()
        try:
            return await func(es, *args, **kwargs)
        finally:
            await es.close()

    return wrapper
