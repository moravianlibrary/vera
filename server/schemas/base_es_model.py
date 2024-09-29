from pydantic import BaseModel, Field
from typing import Optional, TypeVar, List, Dict, Generator
from elasticsearch import Elasticsearch


type EsSession = Elasticsearch

type Keyword = str
type Integer = int
type Boolean = bool
type Date = str

T = TypeVar("T")
Nested = List[T]


class BaseEsModel(BaseModel):
    """
    Base model for Elasticsearch index mappings.
    Provides common fields and methods for transforming Pydantic models
    into Elasticsearch schemas.
    """

    __index_name__: str = "undefined"
    __id_field__: str = "id"
    __index_version__: str = "init"

    id: Optional[int] = Field(None, description="Source ID")

    @classmethod
    def _es_schema(cls) -> dict:
        """
        Converts Pydantic model to Elasticsearch schema (mappings).
        """
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
    def has_current_version_schema(cls, session: EsSession):
        current_mapping = session.indices.get_mapping(
            index=cls.__index_name__
        ).get(cls.__index_name__, {})

        if not current_mapping:
            return False

        return (
            current_mapping.get("mappings", {})
            .get("_meta", {})
            .get("index.version", None)
            == cls.__index_version__
        )

    @classmethod
    def recreate_index(cls, session: EsSession):
        if session.indices.exists(index=cls.__index_name__):
            session.indices.delete(index=cls.__index_name__)
        session.indices.create(index=cls.__index_name__, body=cls._es_schema())

    @classmethod
    def refresh_index(cls, session: EsSession):
        session.indices.refresh(index=cls.__index_name__)

    @classmethod
    def search(
        cls, session: EsSession, query_params: Dict[str, any]
    ) -> Generator[Dict, None, None]:
        return session.search(index=cls.__index_name__, body=query_params)

    @classmethod
    def search_source_ids(
        cls, session: EsSession, query_params: Dict[str, any]
    ) -> List[str]:
        source_ids = []
        scroll_id = None

        while True:
            query_params["_source"] = "id"

            if scroll_id:
                response = session.scroll(scroll_id=scroll_id, scroll="1m")
            else:
                response = session.search(
                    index=cls.__index_name__, body=query_params, scroll="1m"
                )

            hits = response["hits"]["hits"]
            current_ids = [hit["_source"]["id"] for hit in hits]

            source_ids.extend(current_ids)

            scroll_id = response.get("_scroll_id")
            if not scroll_id or len(hits) == 0:
                break

        session.clear_scroll(scroll_id=scroll_id)

        return source_ids

    @classmethod
    def get(cls, session: EsSession, source_id: str):
        return session.get(index=cls.__index_name__, id=source_id)["_source"]

    def save(self, session: EsSession):
        session.index(
            index=self.__index_name__,
            id=self.id,
            body=self.dict(exclude_unset=True),
        )

    def delete(self, session: EsSession):
        session.delete(index=self.__index_name__, id=self.id)
