from elasticsearch import Elasticsearch


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
        es = Elasticsearch("http://localhost:9200")
        if not es.indices.exists(index=INDEX_NAME):
            es.indices.create(index=INDEX_NAME, body=INDEX_SCHEMA)

    def process_issue(self, document_id: int, session: Session):
        pass
