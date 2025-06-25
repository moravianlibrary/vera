from .base import TestSchemaBase
from schemas import AddDocumentResponse


class TestAddDocumentsResponses(TestSchemaBase):
    def test_get_es_schema(self):
        self.maxDiff = None
        self.assertDictEqual(
            AddDocumentResponse._es_schema(),
            {
                "mappings": {
                    "_meta": {"index.version": "v2024.10-1"},
                    "dynamic": "strict",
                    "properties": {
                        "id": {"type": "keyword"},
                        "document_id": {"type": "integer"},
                        "document": {
                            "properties": {
                                "cnb_sysno": {"type": "keyword"},
                                "has_valid_cnb": {"type": "boolean"},
                                "has_valid_main_record": {"type": "boolean"},
                                "issues": {
                                    "properties": {
                                        "barcode": {"type": "keyword"},
                                        "bundle": {"type": "keyword"},
                                        "can_digitize": {"type": "boolean"},
                                        "digitization_registry_id": {
                                            "type": "integer"
                                        },
                                        "digitization_state": {
                                            "type": "keyword"
                                        },
                                        "document_id": {"type": "integer"},
                                        "issuance_type": {"type": "keyword"},
                                        "newly_added": {"type": "boolean"},
                                        "page_count": {"type": "integer"},
                                        "processing": {"type": "boolean"},
                                        "signature": {"type": "keyword"},
                                        "volume": {"type": "keyword"},
                                        "volume_year": {"type": "keyword"},
                                    },
                                    "type": "nested",
                                },
                                "material_type": {"type": "keyword"},
                                "skc_sysno": {"type": "keyword"},
                                "sysno": {"type": "keyword"},
                                "title": {"type": "keyword"},
                            },
                            "type": "nested",
                        },
                        "attributes": {
                            "properties": {
                                "identifier_type": {"type": "keyword"},
                                "value": {"type": "keyword"},
                                "category_id": {"type": "integer"},
                                "extraction_priority": {"type": "integer"},
                                "page_count_manual": {"type": "integer"},
                            },
                            "type": "nested",
                        },
                        "status": {"type": "keyword"},
                        "added_by": {"type": "keyword"},
                        "indexed_at": {"type": "date"},
                    },
                },
            },
        )
