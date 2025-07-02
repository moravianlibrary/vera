from schemas import IndexDocument

from .base import TestSchemaBase


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
                        "id": {"type": "int"},
                        # Main identifiers
                        "sysno": {"type": "keyword"},
                        "barcode": {"type": "keyword"},
                        "volume": {"type": "keyword"},
                        "volume_number": {"type": "int"},
                        "volume_year": {"type": "keyword"},
                        "volume_year_number": {"type": "int"},
                        "bundle": {"type": "keyword"},
                        "bundle_number": {"type": "int"},
                        # Librarian identifiers
                        "cnb": {"type": "keyword"},
                        "signature": {"type": "keyword"},
                        "isxn": {"type": "keyword"},
                        # VERA properties
                        "added_at": {"type": "date"},
                        "indexed_at": {"type": "date"},
                        "added_by": {"type": "keyword"},
                        "category_id": {"type": "int"},
                        "category_ids": {"type": "int"},
                        "category_path": {
                            "type": "nested",
                            "properties": {
                                "category_id": {"type": "int"},
                                "category_name": {"type": "keyword"},
                            },
                        },
                        "document_flags": {"type": "keyword"},
                        "skc_sysno": {"type": "keyword"},
                        "cnb_sysno": {"type": "keyword"},
                        "digitization_registry_id": {"type": "int"},
                        "digitization_state": {"type": "keyword"},
                        # Page count
                        "page_count": {"type": "int"},
                        "page_count_catalog": {"type": "int"},
                        "page_count_predicted": {"type": "int"},
                        "page_count_manual": {"type": "int"},
                        # Extraction properties
                        "dedicated_scanner": {"type": "keyword"},
                        "extraction_priority": {"type": "int"},
                        "extraction_ids": {"type": "int"},
                        "digitization_list_id": {"type": "int"},
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
