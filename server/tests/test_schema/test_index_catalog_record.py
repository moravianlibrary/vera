from .base import TestSchemaBase
from schemas import IndexDocument


class TestIndexCatalogRecord(TestSchemaBase):
    def test_get_es_schema(self):
        self.maxDiff = None
        self.assertDictEqual(
            IndexDocument.get_es_schema(),
            {
                "mappings": {
                    "_meta": {"index.version": "v2024.09-1"},
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
                        "has_valid_main_record": {"type": "boolean"},
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
                        "has_valid_cnb": {"type": "boolean"},
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
                        "is_extractable": {"type": "boolean"},
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
