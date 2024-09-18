from typing import Dict, Generator, List
import elasticsearch
from models import Document
from services.external.aleph import AlephRecord
from config import VeraConfig
import requests
from requests.exceptions import RequestException
from .parsers.volume_parser import (
    parse_volume,
    parse_volume_year,
    parse_bundle,
)


INDEX_NAME = "documents"
INDEX_SCHEMA = {
    "mappings": {
        "_meta": {"index.version": "init"},
        "properties": {
            "id": {"type": "integer"},
            # Main identifiers
            "sysno": {"type": "keyword"},
            "barcode": {"type": "keyword"},
            "volume": {"type": "keyword"},
            "volume_number": {"type": "integer"},
            "volume_year": {"type": "keyword"},
            "volume_year_number": {"type": "integer"},
            "bundle": {"type": "keyword"},
            "bundle_number": {"type": "integer"},
            # Librarian identifiers
            "cnb": {"type": "keyword"},
            "signature": {"type": "keyword"},
            "isxn": {"type": "keyword"},
            # VERA properties
            "added_at": {"type": "date"},
            "added_by": {"type": "keyword"},
            "category_id": {"type": "integer"},
            "category_path": {
                "type": "nested",
                "properties": {
                    "category_id": {"type": "integer"},
                    "category_name": {"type": "keyword"},
                },
            },
            "skc_sysno": {"type": "keyword"},
            "skc_diff": {
                "type": "nested",
                "properties": {
                    "result": {"type": "keyword"},
                    "tag": {"type": "keyword"},
                    "indicator1": {"type": "keyword"},
                    "indicator2": {"type": "keyword"},
                    "subfield_differences": {
                        "type": "nested",
                        "properties": {
                            "code": {"type": "keyword"},
                            "value": {"type": "keyword"},
                            "different_to": {"type": "keyword"},
                        },
                    },
                },
            },
            "cnb_sysno": {"type": "keyword"},
            "cnb_diff": {
                "type": "nested",
                "properties": {
                    "result": {"type": "keyword"},
                    "tag": {"type": "keyword"},
                    "indicator1": {"type": "keyword"},
                    "indicator2": {"type": "keyword"},
                    "subfield_differences": {
                        "type": "nested",
                        "properties": {
                            "code": {"type": "keyword"},
                            "value": {"type": "keyword"},
                            "different_to": {"type": "keyword"},
                        },
                    },
                },
            },
            "digitization_registry_id": {"type": "integer"},
            "digitization_state": {"type": "keyword"},  # Enum type
            # Page count
            "page_count": {"type": "integer"},
            "page_count_catalog": {"type": "integer"},
            "page_count_predicted": {"type": "integer"},
            "page_count_manual": {"type": "integer"},
            # Extraction properties
            "dedicated_scanner": {"type": "keyword"},
            "extraction_priority": {"type": "integer"},
            "digitization_list_id": {"type": "integer"},
            # Other properties
            "material_type": {"type": "keyword"},  # Enum type
            "issuance_type": {"type": "keyword"},  # Enum type
            "title": {"type": "keyword"},
            "size": {"type": "keyword"},
            "location_uri": {"type": "keyword"},
            # Publication properties
            "publisher": {"type": "keyword"},
            "publishing_place": {"type": "keyword"},
            "publishing_year": {"type": "keyword"},
            "languages": {"type": "keyword"},
            "frequencies": {"type": "nested"},  # JSON type
        },
    },
}


class DocumentsIndexer:
    def __init__(self, url, username, password):
        self.es = elasticsearch.Elasticsearch(
            url, basic_auth=(username, password)
        )
        if not self.es.indices.exists(index=INDEX_NAME):
            self.es.indices.create(index=INDEX_NAME, body=INDEX_SCHEMA)

    def close(self):
        self.es.close()

    def has_current_version_schema(self):
        current_mapping = self.es.indices.get_mapping(index=INDEX_NAME).get(
            INDEX_NAME, {}
        )

        if not current_mapping:
            return False

        return (
            current_mapping.get("mappings", {})
            .get("_meta", {})
            .get("index.version", None)
            == INDEX_SCHEMA["mappings"]["_meta"]["index.version"]
        )

    def recreate_index(self):
        self.es.indices.delete(index=INDEX_NAME)
        self.es.indices.create(index=INDEX_NAME, body=INDEX_SCHEMA)

    def index(self, document: Document):
        aleph_record = AlephRecord(
            document.catalog_record.sysno, document.catalog_record.main_record
        )

        doc = {
            "id": document.id,
            "sysno": document.sysno,
            "barcode": document.barcode,
            "volume": document.volume,
            "volume_number": parse_volume(document.volume),
            "volume_year": document.volume_year,
            "volume_year_number": parse_volume_year(document.volume_year),
            "bundle": document.bundle,
            "bundle_number": parse_bundle(document.bundle),
            "cnb": document.cnb,
            "signature": document.signature,
            "isxn": document.isxn,
            "added_at": document.added_at.isoformat(),
            "added_by": document.added_by,
            "category_id": document.category_id,
            "category_path": document.category_path,
            # Catalog properties
            "skc_sysno": document.catalog_record.skc_sysno,
            "has_valid_main_record": (
                document.catalog_record.has_valid_main_record
            ),
            "cnb_sysno": document.catalog_record.cnb_sysno,
            "has_valid_cnb": document.catalog_record.has_valid_cnb,
            "digitization_registry_id": document.digitization_registry_id,
            "digitization_state": (
                document.digitization_state.value
                if document.digitization_state
                else None
            ),
            "page_count": document.pages_count,
            "page_count_catalog": document.pages_count_catalog,
            "page_count_predicted": document.pages_count_predicted,
            "page_count_manual": document.pages_count_manual,
            "dedicated_scanner": document.dedicated_scanner,
            "extraction_priority": document.extraction_priority,
            "digitization_list_id": document.digitization_list_id,
            "material_type": (
                aleph_record.material_type.value
                if aleph_record.material_type
                else None
            ),
            "issuance_type": (
                document.issuance_type.value
                if document.issuance_type
                else None
            ),
            "title": aleph_record.title,
            "size": aleph_record.size,
            "location_uri": aleph_record.locationUri,
            "publisher": aleph_record.publisher,
            "publishing_place": aleph_record.publishing_place,
            "publishing_year": aleph_record.publishing_year,
            "languages": aleph_record.languages,
            "frequencies": [
                frequency.to_dict() for frequency in aleph_record.frequencies
            ],
        }

        self.es.index(index=INDEX_NAME, id=document.id, body=doc)

    def refresh(self):
        self.es.indices.refresh(index=INDEX_NAME)

    def get(self, document_id: int):
        return self.es.get(index=INDEX_NAME, id=document_id)["_source"]

    def delete(self, document_id: int):
        self.es.delete(index=INDEX_NAME, id=document_id)

    def search(
        self, query_params: Dict[str, any]
    ) -> Generator[Dict, None, None]:
        return self.es.search(
            index=INDEX_NAME,
            body=query_params,
        )

    def get_document_ids(self, query_params: Dict[str, any]) -> List[int]:
        document_ids = []
        scroll_id = None

        while True:
            query_params["_source"] = "id"

            if scroll_id:
                response = self.es.scroll(scroll_id=scroll_id, scroll="1m")
            else:
                response = self.es.search(
                    index=INDEX_NAME, body=query_params, scroll="1m"
                )

            hits = response["hits"]["hits"]
            current_ids = [hit["_source"]["id"] for hit in hits]

            document_ids.extend(current_ids)

            scroll_id = response.get("_scroll_id")
            if not scroll_id or len(hits) == 0:
                break

        self.es.clear_scroll(scroll_id=scroll_id)

        return document_ids

    @staticmethod
    def restrict_query_params(
        query_params: Dict[str, any], restriction_clause: Dict[str, any]
    ):
        if "match_all" in query_params["query"]:
            query_params["query"] = {"bool": {"must": [restriction_clause]}}
        elif "match" in query_params["query"]:
            # match and bool are mutually exclusive, so it is guaranteed that
            # valid query params would not contain both
            match_clause = query_params["query"].pop("match")
            query_params["query"]["bool"] = {
                "must": [
                    restriction_clause,
                    {"term": match_clause},
                ]
            }
        elif "bool" in query_params["query"]:
            if "must" in query_params["query"]["bool"]:
                if isinstance(query_params["query"]["bool"]["must"], list):
                    query_params["query"]["bool"]["must"].append(
                        restriction_clause
                    )
                else:
                    must_term = query_params["query"]["bool"]["must"]
                    query_params["query"]["bool"] = {
                        "must": [restriction_clause, must_term]
                    }
            else:
                query_params["query"]["bool"]["must"] = [restriction_clause]

        return query_params

    @staticmethod
    def restrict_query_params_for_username(
        query_params: Dict[str, any],
        username: str,
    ) -> Generator[Dict, None, None]:
        return DocumentsIndexer.restrict_query_params(
            query_params, restriction_clause={"term": {"added_by": username}}
        )

    @staticmethod
    def restrict_query_params_for_categories(
        query_params: Dict[str, any],
        category_ids: List[int],
        username: str,
    ) -> Generator[Dict, None, None]:
        categories_restriction = {
            "nested": {
                "path": "category_path",
                "query": {
                    "terms": {"category_path.category_id": category_ids}
                },
            }
        }
        username_restriction = {"term": {"added_by": username}}
        return DocumentsIndexer.restrict_query_params(
            query_params,
            restriction_clause={
                "bool": {
                    "should": [
                        categories_restriction,
                        username_restriction,
                    ],
                    "minimum_should_match": 1,
                }
            },
        )

    @staticmethod
    def get_instance() -> "DocumentsIndexer":
        return DocumentsIndexer(
            VeraConfig.ElasticsearchUrl,
            VeraConfig.ElasticsearchUsername,
            VeraConfig.ElasticsearchPassword,
        )

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
