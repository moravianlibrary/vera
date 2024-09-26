from typing import Dict, Generator, List
import elasticsearch
from config import VeraConfig
import requests
from requests.exceptions import RequestException


class BaseIndexer:
    def __init__(
        self,
        url: str,
        username: str,
        password: str,
        index_name: str,
        index_schema: Dict[str, any],
    ):
        self.es = elasticsearch.Elasticsearch(
            url, basic_auth=(username, password)
        )
        self.index_name = index_name
        self.index_schema = index_schema

        if not self.es.indices.exists(index=index_name):
            self.es.indices.create(index=index_name, body=index_schema)

    def close(self):
        self.es.close()

    def has_current_version_schema(self):
        current_mapping = self.es.indices.get_mapping(
            index=self.index_name
        ).get(self.index_name, {})

        if not current_mapping:
            return False

        return (
            current_mapping.get("mappings", {})
            .get("_meta", {})
            .get("index.version", None)
            == self.index_schema["mappings"]["_meta"]["index.version"]
        )

    def recreate_index(self):
        self.es.indices.delete(index=self.index_name)
        self.es.indices.create(index=self.index_name, body=self.index_schema)

    def index(self, source_id: str, source: Dict[str, any]):
        self.es.index(index=self.index_name, id=source_id, body=source)

    def refresh(self):
        self.es.indices.refresh(index=self.index_name)

    def get(self, source_id: int):
        return self.es.get(index=self.index_name, id=source_id)["_source"]

    def delete(self, source_id: int):
        self.es.delete(index=self.index_name, id=source_id)

    def search(
        self, query_params: Dict[str, any]
    ) -> Generator[Dict, None, None]:
        return self.es.search(
            index=self.index_name,
            body=query_params,
        )

    def get_source_ids(self, query_params: Dict[str, any]) -> List[int]:
        source_ids = []
        scroll_id = None

        while True:
            query_params["_source"] = "id"

            if scroll_id:
                response = self.es.scroll(scroll_id=scroll_id, scroll="1m")
            else:
                response = self.es.search(
                    index=self.index_name, body=query_params, scroll="1m"
                )

            hits = response["hits"]["hits"]
            current_ids = [hit["_source"]["id"] for hit in hits]

            source_ids.extend(current_ids)

            scroll_id = response.get("_scroll_id")
            if not scroll_id or len(hits) == 0:
                break

        self.es.clear_scroll(scroll_id=scroll_id)

        return source_ids

    @staticmethod
    def is_indexer_available() -> bool:
        # TODO: rework
        try:
            response = requests.get(VeraConfig.ElasticsearchUrl)
            if response.status_code not in [200, 401]:
                return False
        except RequestException:
            return False
        try:
            return elasticsearch.Elasticsearch(
                VeraConfig.ElasticsearchUrl,
                basic_auth=(
                    VeraConfig.ElasticsearchUsername,
                    VeraConfig.ElasticsearchPassword,
                ),
            ).ping()
        except Exception:
            return False
