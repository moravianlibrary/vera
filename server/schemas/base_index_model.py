from pydantic import BaseModel, Field
from typing import Optional, TypeVar, List
from .base_indexer import BaseIndexer
from config import VeraConfig


type Keyword = str
type Integer = int
type Boolean = bool
type Date = str

T = TypeVar("T")
Nested = List[T]


TYPE_MAPPING = {
    "Keyword": "keyword",
    "int": "integer",
    "bool": "boolean",
    "list": "nested",
    "datetime": "date",
}


class BaseIndexModel(BaseModel):
    """
    Base model for Elasticsearch index mappings.
    Provides common fields and methods for transforming Pydantic models
    into Elasticsearch schemas.
    """

    __index_name__: str = "undefined"
    __index_version__: str = "init"

    id: Optional[int] = Field(None, description="Source ID")

    @classmethod
    def get_es_schema(cls) -> dict:
        """
        Converts Pydantic model to Elasticsearch schema (mappings).
        """

        def map_pydantic_type_to_es(field_type: str) -> str:
            return TYPE_MAPPING.get(field_type, "keyword")

        es_schema = {
            "mappings": {
                "_meta": {"index.version": cls.__index_version__},
                "properties": {},
            }
        }
        properties = es_schema["mappings"]["properties"]

        for field_name, field_info in cls.__annotations__.items():
            if (
                hasattr(field_info, "__origin__")
                and field_info.__origin__ == list
            ):
                item_type = field_info.__args__[0]
                if issubclass(item_type, BaseModel):
                    properties[field_name] = {
                        "type": "nested",
                        "properties": item_type.get_es_schema()["mappings"][
                            "properties"
                        ],
                    }
            else:
                properties[field_name] = {"type": field_info.__name__.lower()}

        return es_schema
        es_schema = {"mappings": {"properties": {}}}
        properties = es_schema["mappings"]["properties"]

        for field_name, field_info in cls.__annotations__.items():
            properties[field_name] = {"type": field_info.__name__.lower()}

        return es_schema

    @classmethod
    def get_indexer_instance(cls) -> "BaseIndexer":
        return BaseIndexer(
            VeraConfig.ElasticsearchUrl,
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
            cls.__index_name__,
            cls.get_es_schema(),
        )
