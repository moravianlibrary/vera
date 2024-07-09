from typing import Dict, Generator
from elasticsearch import Elasticsearch
from schemas.catalog_records import CatalogRecord
from schemas.documents import Document
from services.external.aleph.record import AlephRecord


INDEX_NAME = "documents"
INDEX_SCHEMA = {
    "mappings": {
        "properties": {
            "id": {"type": "integer"},
            # Main identifiers
            "sysno": {"type": "keyword"},
            "barcode": {"type": "keyword"},
            "volume": {"type": "keyword"},
            "volume_year": {"type": "keyword"},
            "bundle": {"type": "keyword"},
            # Librarian identifiers
            "cnb": {"type": "keyword"},
            "signature": {"type": "keyword"},
            "isxn": {"type": "keyword"},
            # VERA properties
            "added_at": {"type": "date"},
            "added_by": {"type": "keyword"},
            "category_id": {"type": "integer"},
            "category_path": {"type": "keyword"},  # Hierarchical path
            # Alternate identifiers and derived properties
            "skc_sysno": {"type": "keyword"},
            "skc_confidence": {"type": "float"},
            "cnb_sysno": {"type": "keyword"},
            "cnb_confidence": {"type": "float"},
            "digitization_registry_id": {"type": "integer"},
            "digitization_state": {"type": "keyword"},  # Enum type
            # Page count
            "page_count_catalog": {"type": "integer"},
            "page_count_predicted": {"type": "integer"},
            "page_count_manual": {"type": "integer"},
            # Extraction properties
            "dedicated_scanner": {"type": "keyword"},
            "extraction_priority": {"type": "integer"},
            "extraction_id": {"type": "integer"},
            # Other properties
            "material_type": {"type": "keyword"},  # Enum type
            "issuance_type": {"type": "keyword"},  # Enum type
            "title": {"type": "text"},
            "size": {"type": "keyword"},
            "locationUri": {"type": "keyword"},
            # Publication properties
            "publisher": {"type": "keyword"},
            "publishing_place": {"type": "keyword"},
            "publishing_year": {"type": "keyword"},
            "languages": {"type": "keyword"},
            "frequencies": {"type": "nested"},  # JSON type
        }
    }
}


class DocumentsIndex:
    def __init__(self, url):
        self.es = Elasticsearch("http://localhost:9200")
        if not self.es.indices.exists(index=INDEX_NAME):
            self.es.indices.create(index=INDEX_NAME, body=INDEX_SCHEMA)

    def index(self, catalog_record: CatalogRecord, document: Document):
        aleph_record = AlephRecord(catalog_record.sysno, catalog_record.marc)

        doc = {
            "id": document.id,
            "sysno": document.sysno,
            "barcode": document.barcode,
            "volume": document.volume,
            "volume_year": document.volume_year,
            "bundle": document.bundle,
            "cnb": document.cnb,
            "signature": document.signature,
            "isxn": document.isxn,
            "added_at": document.added_at.isoformat(),
            "added_by": document.added_by,
            "category_id": document.category_id,
            "category_path": document.category_path,
            "skc_sysno": catalog_record.skc_sysno,
            "skc_confidence": catalog_record.skc_confidence,
            "cnb_sysno": catalog_record.cnb_sysno,
            "cnb_confidence": catalog_record.cnb_confidence,
            "digitization_registry_id": document.digitization_registry_id,
            "digitization_state": document.digitization_state.value,
            "page_count_catalog": document.pages_count_catalog,
            "page_count_predicted": document.pages_count_predicted,
            "page_count_manual": document.pages_count_manual,
            "dedicated_scanner": document.dedicated_scanner,
            "extraction_priority": document.extraction_priority,
            "extraction_id": document.extraction_id,
            "material_type": aleph_record.material_type.value,
            "issuance_type": document.issuance_type.value,
            "title": aleph_record.title,
            "size": aleph_record.size,
            "locationUri": aleph_record.locationUri,
            "publisher": aleph_record.publisher,
            "publishing_place": aleph_record.publishing_place,
            "publishing_year": aleph_record.publishing_year,
            "languages": aleph_record.languages,
            "frequencies": aleph_record.frequencies,
        }
        self.es.index(index=INDEX_NAME, id=document.id, body=doc)

    def delete(self, document_id: int):
        self.es.delete(index=INDEX_NAME, id=document_id)

    def search(self, query: str) -> Generator[Dict, None, None]:
        res = self.es.search(
            index=INDEX_NAME,
            body=query,
        )
        for hit in res["hits"]["hits"]:
            yield Document(**hit["_source"])
