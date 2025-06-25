from .base import TestSchemaBase
from schemas import IndexDocument


class TestIndexDocument(TestSchemaBase):
    def test_get_es_schema(self):
        self.maxDiff = None
        self.assertDictEqual(
            IndexDocument._es_schema(),
            {
                "mappings": {
                    "_meta": {"index.version": "v2024.10-1"},
                    "dynamic": "strict",
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
                        "indexed_at": {"type": "date"},
                        "added_by": {"type": "keyword"},
                        "category_id": {"type": "integer"},
                        "category_ids": {"type": "integer"},
                        "category_path": {
                            "type": "nested",
                            "properties": {
                                "category_id": {"type": "integer"},
                                "category_name": {"type": "keyword"},
                            },
                        },
                        "document_flags": {"type": "keyword"},
                        "skc_sysno": {"type": "keyword"},
                        "cnb_sysno": {"type": "keyword"},
                        "digitization_registry_id": {"type": "integer"},
                        "digitization_state": {"type": "keyword"},
                        # Page count
                        "page_count": {"type": "integer"},
                        "page_count_catalog": {"type": "integer"},
                        "page_count_predicted": {"type": "integer"},
                        "page_count_manual": {"type": "integer"},
                        # Extraction properties
                        "dedicated_scanner": {"type": "keyword"},
                        "extraction_priority": {"type": "integer"},
                        "extraction_ids": {"type": "integer"},
                        "digitization_list_id": {"type": "integer"},
                        # Other properties
                        "material_type": {"type": "keyword"},
                        "issuance_type": {"type": "keyword"},
                        "title": {"type": "keyword"},
                        "size": {"type": "keyword"},
                        "location_uri": {"type": "keyword"},
                        # Publication properties
                        "publisher": {"type": "keyword"},
                        "publishing_place": {"type": "keyword"},
                        "publishing_year": {"type": "keyword"},
                        "languages": {"type": "keyword"},
                        "frequencies": {
                            "type": "nested",
                            "properties": {
                                "frequency": {"type": "keyword"},
                                "date": {"type": "keyword"},
                            },
                        },
                    },
                },
            },
        )
