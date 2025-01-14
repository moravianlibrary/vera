from pydantic import BaseModel
from typing import List, Dict, Generator, get_type_hints
from elasticsearch import Elasticsearch
from enum import Enum
from typing import TypeVar, Union, get_origin, get_args


type EsSession = Elasticsearch

type Keyword = str
type Integer = int
type Boolean = bool
type Date = str
T = TypeVar("T")
SingleOrList = Union[T, List[T]]


class BaseEsModel(BaseModel):
    """
    Base model for Elasticsearch index mappings.
    Provides common fields and methods for transforming Pydantic models
    into Elasticsearch schemas.
    """

    __index_name__: str = "undefined"
    __id_field__: str = "id"
    __index_version__: str = "init"
    __dynamic__: str = "strict"

    @classmethod
    def __es_schema_properties__(cls) -> dict:
        properties = {}

        for field_name, field_info in get_type_hints(cls).items():
            if field_name.startswith("_"):
                continue
            if hasattr(field_info, "_name") and field_info._name == "Optional":
                field_info = field_info.__args__[0]
            if get_origin(field_info) is Union:
                field_info = get_args(field_info)[0]
            if (
                hasattr(field_info, "__origin__")
                and field_info.__origin__ == list
            ):
                field_info = field_info.__args__[0]

            if isinstance(field_info, type) and issubclass(
                field_info, BaseEsModel
            ):
                properties[field_name] = {
                    "type": "nested",
                    "properties": field_info.__es_schema_properties__(),
                }
            elif isinstance(field_info, type) and issubclass(field_info, Enum):
                properties[field_name] = {"type": "keyword"}
            else:
                properties[field_name] = {"type": field_info.__name__.lower()}

        return properties

    @classmethod
    def _es_schema(cls) -> dict:
        """
        Converts Pydantic model to Elasticsearch schema (mappings).
        """
        return {
            "mappings": {
                "_meta": {"index.version": cls.__index_version__},
                "dynamic": cls.__dynamic__,
                "properties": cls.__es_schema_properties__(),
            }
        }

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
    def search_all(
        cls,
        session: EsSession,
        query_params: Dict[str, any],
        fields: List[str] | None = None,
    ) -> List[Dict]:
        documents = []
        scroll_id = None

        while True:
            if scroll_id:
                response = session.scroll(scroll_id=scroll_id, scroll="1m")
            else:
                response = session.search(
                    index=cls.__index_name__, body=query_params, scroll="1m"
                )

            hits = response["hits"]["hits"]
            documents.extend(
                (
                    {
                        field: hit["_source"][field]
                        for field in fields
                        if field in hit["_source"]
                    }
                    if fields
                    else hit["_source"]
                )
                for hit in hits
            )

            scroll_id = response.get("_scroll_id")
            if not scroll_id or len(hits) == 0:
                break

        return documents

    @classmethod
    def search_source_ids(
        cls, session: EsSession, query_params: Dict[str, any]
    ) -> List[str]:
        source_ids = []
        scroll_id = None

        while True:
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

    @classmethod
    def delete(
        cls, session: EsSession, source_id: str, wait_for: bool = False
    ):
        session.delete(
            index=cls.__index_name__,
            id=source_id,
            refresh="true" if wait_for else None,
        )

    def save(self, session: EsSession, wait_for: bool = False):
        session.index(
            index=self.__index_name__,
            id=self.id,
            document=self.model_dump_json(exclude_none=True),
            refresh="true" if wait_for else None,
        )
