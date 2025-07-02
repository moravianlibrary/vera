from schemas import IndexCatalogRecord

from .base import TestSchemaBase


class TestIndexCatalogRecord(TestSchemaBase):
    def test_get_es_schema(self):
        self.maxDiff = None
        self.assertDictEqual(
            IndexCatalogRecord._es_schema(),
            {
                "mappings": {
                    "_meta": {"index.version": "v2024.10-1"},
                    "dynamic": "strict",
                    "properties": {
                        "id": {"type": "keyword"},  # sysno
                        "main_record": {
                            "properties": {
                                "fields": {
                                    "properties": {
                                        "control_field": {"type": "boolean"},
                                        "data": {"type": "keyword"},
                                        "ind1": {"type": "keyword"},
                                        "ind2": {"type": "keyword"},
                                        "subfields": {
                                            "properties": {
                                                "code": {"type": "keyword"},
                                                "value": {"type": "keyword"},
                                            },
                                            "type": "nested",
                                        },
                                        "tag": {"type": "keyword"},
                                    },
                                    "type": "nested",
                                },
                                "leader": {"type": "keyword"},
                            },
                            "type": "nested",
                        },
                        "cnb": {"type": "keyword"},
                        "language": {"type": "keyword"},
                        "signature": {"type": "keyword"},
                        "isxn": {"type": "keyword"},
                        "barcodes": {"type": "keyword"},
                        "skc_sysno": {"type": "keyword"},
                        "skc_record": {
                            "properties": {
                                "fields": {
                                    "properties": {
                                        "control_field": {"type": "boolean"},
                                        "data": {"type": "keyword"},
                                        "ind1": {"type": "keyword"},
                                        "ind2": {"type": "keyword"},
                                        "subfields": {
                                            "properties": {
                                                "code": {"type": "keyword"},
                                                "value": {"type": "keyword"},
                                            },
                                            "type": "nested",
                                        },
                                        "tag": {"type": "keyword"},
                                    },
                                    "type": "nested",
                                },
                                "leader": {"type": "keyword"},
                            },
                            "type": "nested",
                        },
                        "skc_difference": {
                            "properties": {
                                "id": {"type": "int"},
                                "tag": {"type": "keyword"},
                                "ind1": {"type": "keyword"},
                                "ind2": {"type": "keyword"},
                                "control_field": {"type": "boolean"},
                                "difference_type": {"type": "keyword"},
                                "approved_by": {"type": "keyword"},
                                "approved_at": {"type": "date"},
                                "subfield_differences": {
                                    "properties": {
                                        "id": {"type": "int"},
                                        "code": {"type": "keyword"},
                                        "value": {"type": "keyword"},
                                        "different_to": {"type": "keyword"},
                                        "differs": {"type": "boolean"},
                                    },
                                    "type": "nested",
                                },
                            },
                            "type": "nested",
                        },
                        "skc_record_flags": {"type": "keyword"},
                        "skc_difference_tag_facets": {"type": "keyword"},
                        "cnb_sysno": {"type": "keyword"},
                        "cnb_record": {
                            "properties": {
                                "fields": {
                                    "properties": {
                                        "control_field": {"type": "boolean"},
                                        "data": {"type": "keyword"},
                                        "ind1": {"type": "keyword"},
                                        "ind2": {"type": "keyword"},
                                        "subfields": {
                                            "properties": {
                                                "code": {"type": "keyword"},
                                                "value": {"type": "keyword"},
                                            },
                                            "type": "nested",
                                        },
                                        "tag": {"type": "keyword"},
                                    },
                                    "type": "nested",
                                },
                                "leader": {"type": "keyword"},
                            },
                            "type": "nested",
                        },
                        "cnb_difference": {
                            "properties": {
                                "id": {"type": "int"},
                                "tag": {"type": "keyword"},
                                "ind1": {"type": "keyword"},
                                "ind2": {"type": "keyword"},
                                "control_field": {"type": "boolean"},
                                "difference_type": {"type": "keyword"},
                                "approved_by": {"type": "keyword"},
                                "approved_at": {"type": "date"},
                                "subfield_differences": {
                                    "properties": {
                                        "id": {"type": "int"},
                                        "code": {"type": "keyword"},
                                        "value": {"type": "keyword"},
                                        "different_to": {"type": "keyword"},
                                        "differs": {"type": "boolean"},
                                    },
                                    "type": "nested",
                                },
                            },
                            "type": "nested",
                        },
                        "cnb_record_flags": {"type": "keyword"},
                        "cnb_difference_tag_facets": {"type": "keyword"},
                        "has_active_documents": {"type": "boolean"},
                        "has_documents": {"type": "boolean"},
                        "added_at": {"type": "date"},
                        "updated_at": {"type": "date"},
                        "indexed_at": {"type": "date"},
                        "material_type": {"type": "keyword"},
                        "title": {"type": "keyword"},
                        "size": {"type": "keyword"},
                        "location_uri": {"type": "keyword"},
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
