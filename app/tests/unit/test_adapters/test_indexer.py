from typing import List
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock

from esorm import es, setup_mappings

from adapters.indexer import IndexerModel, IndexerNestedModel
from schemas.addition import Addition
from schemas.additional_properties import AdditionalProperties
from schemas.catalog_record import CatalogRecord
from schemas.category import Category
from schemas.digitization_list import DigitizationList
from schemas.document import Document
from schemas.intention import Intention
from schemas.project import Project
from schemas.proposal import Proposal


class TestIndexSchemaContext:
    def __init__(self, setup_mappings: bool = True) -> None:
        self.setup_mappings = setup_mappings
        self.init_done: bool = False
        self.num_indexes: int = 17

    async def setUp(self):
        if self.init_done:
            return

        self.mock_client = AsyncMock()

        self.mock_client.indices.get_mapping = AsyncMock()
        self.mock_client.indices.get_mapping.return_value = {}

        self.mock_client.indices.create = AsyncMock()
        self.mock_client.indices.put_mapping = AsyncMock()

        es.set_client(self.mock_client)

        if self.setup_mappings:
            await setup_mappings()

        self.init_done = True


class TestIndexBase(IsolatedAsyncioTestCase):
    context: TestIndexSchemaContext

    async def asyncSetUp(self):
        await self.context.setUp()

        self.assertEqual(
            self.context.mock_client.indices.get_mapping.await_count,
            self.context.num_indexes,
        )
        self.assertEqual(
            self.context.mock_client.indices.create.await_count,
            self.context.num_indexes,
        )
        self.context.mock_client.indices.put_mapping.assert_not_awaited()

        self.maxDiff = None

    async def assertEsSchema(
        self, schema_class: IndexerModel, expected_properties
    ):
        self.assertIsNotNone(
            schema_class.ESConfig.index, "Index name must be defined"
        )

        called_kwargs = [
            kwargs
            for _, kwargs in (
                self.context.mock_client.indices.create.call_args_list
            )
            if kwargs.get("index") == schema_class.ESConfig.index
        ]

        self.assertEqual(
            len(called_kwargs),
            1,
            f"Index {schema_class.ESConfig.index} should be created once",
        )
        self.assertDictEqual(
            called_kwargs[0]["mappings"]["properties"],
            expected_properties,
            "ES schema properties do not match expected properties",
        )


class TestIndexSchema(TestIndexBase):
    context = TestIndexSchemaContext()

    async def test_addition_schema(self):
        await self.assertEsSchema(
            Addition,
            {
                "batch_id": {"type": "long"},
                "batch_name": {"type": "text"},
                "file_name": {"type": "text"},
                "created_by": {"type": "keyword"},
                "created_at": {"type": "date"},
                "archived": {"type": "boolean"},
                "identifier_type": {"type": "keyword"},
                "identifier_value": {"type": "keyword"},
                "category_id": {"type": "long"},
                "priority": {"type": "keyword"},
                "allow_new_iteration": {"type": "boolean"},
                "ignore_digitization_check": {"type": "boolean"},
                "status": {"type": "keyword"},
                "eligibility_status": {"type": "keyword"},
                "project": {
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                        "description": {"type": "text"},
                    }
                },
                "proposal": {
                    "properties": {
                        "id": {"type": "long"},
                        "batch_id": {"type": "long"},
                        "batch_name": {"type": "text"},
                        "file_name": {"type": "text"},
                        "reason_message": {"type": "text"},
                    }
                },
            },
        )

    async def test_catalog_record_schema(self):
        await self.assertEsSchema(
            CatalogRecord,
            {
                "base": {"type": "keyword"},
                "system_number": {"type": "keyword"},
                "identifiers": {
                    "type": "nested",
                    "properties": {
                        "identifier_type": {"type": "keyword"},
                        "identifier_value": {"type": "keyword"},
                    },
                },
                "material_type": {"type": "keyword"},
                "title": {"type": "text"},
                "subtitle": {"type": "text"},
                "force_valid": {"type": "boolean"},
                "is_valid": {"type": "boolean"},
                "current_status": {"type": "keyword"},
                "properties": {"properties": {}},
                "updated_at": {"type": "date"},
            },
        )

    async def test_category_schema(self):
        await self.assertEsSchema(
            Category,
            {
                "name": {"type": "keyword"},
                "description": {"type": "keyword"},
                "parent_id": {"type": "long"},
                "level": {"type": "keyword"},
                "assignable": {"type": "boolean"},
                "extract_whole": {"type": "boolean"},
                "disabled": {"type": "boolean"},
                "archived": {"type": "boolean"},
                "created_at": {"type": "date"},
                "path": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                    },
                },
                "direct_groups": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                    },
                },
                "direct_users": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "keyword"},
                        "username": {"type": "keyword"},
                    },
                },
                "effective_groups": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                    },
                },
                "effective_users": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "keyword"},
                        "username": {"type": "keyword"},
                    },
                },
                "proportions": {
                    "type": "nested",
                    "properties": {
                        "distribution_id": {"type": "long"},
                        "proportion": {"type": "double"},
                        "overall_proportion": {"type": "double"},
                    },
                },
                "statistics": {
                    "properties": {
                        "count_total_pages": {"type": "long"},
                        "count_total_documents": {"type": "long"},
                        "count_extractable_pages": {"type": "long"},
                        "count_extractable_documents": {"type": "long"},
                        "count_extracted_pages": {"type": "long"},
                        "count_extracted_documents": {"type": "long"},
                    },
                },
                "document_discovery": {
                    "properties": {
                        "id": {"type": "long"},
                        "task_schedule_id": {"type": "long"},
                    },
                },
            },
        )

    async def test_digitization_list_schema(self):
        await self.assertEsSchema(
            DigitizationList,
            {
                "state": {"type": "keyword"},
                "intentions": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                    },
                },
                "count_documents": {"type": "long"},
                "count_pages": {"type": "long"},
                "created_at": {"type": "date"},
                "created_by": {"type": "keyword"},
            },
        )

    async def test_document_schema(self):
        await self.assertEsSchema(
            Document,
            {
                "catalog_record_id": {"type": "text"},
                "catalog_record_valid": {"type": "boolean"},
                "iteration_id": {"type": "long"},
                "iteration": {"type": "integer"},
                "barcode": {"type": "keyword"},
                "volume_number": {"type": "keyword"},
                "volume_year": {"type": "keyword"},
                "bundle": {"type": "keyword"},
                "material_type": {"type": "keyword"},
                "issuance_type": {"type": "keyword"},
                "digitization_state": {"type": "keyword"},
                "digitization_records": {
                    "type": "nested",
                    "properties": {
                        "registry_record_id": {"type": "keyword"},
                        "record_state": {"type": "keyword"},
                        "registry_issue_id": {"type": "keyword"},
                        "issue_state": {"type": "keyword"},
                    },
                },
                "page_count_manual": {"type": "integer"},
                "page_count": {"type": "integer"},
                "properties": {"properties": {}},
                "category_id": {"type": "long"},
                "priority": {"type": "integer"},
                "digitization_list_id": {"type": "long"},
                "digitization_list_state": {"type": "keyword"},
                "current_status": {"type": "keyword"},
                "created_by": {"type": "keyword"},
                "created_at": {"type": "date"},
                "updated_at": {"type": "date"},
            },
        )

    async def test_intention_schema(self):
        await self.assertEsSchema(
            Intention,
            {
                "name": {"type": "keyword"},
                "description": {"type": "keyword"},
                "target_page_count": {"type": "long"},
                "start_date": {"type": "date"},
                "end_date": {"type": "date"},
                "project": {
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                        "created_by": {"type": "keyword"},
                        "status": {"type": "keyword"},
                        "is_archived": {"type": "boolean"},
                    }
                },
                "is_archived": {"type": "boolean"},
            },
        )

    async def test_project_schema(self):
        await self.assertEsSchema(
            Project,
            {
                "name": {"type": "keyword"},
                "description": {"type": "keyword"},
                "target_page_count": {"type": "long"},
                "start_date": {"type": "date"},
                "end_date": {"type": "date"},
                "created_by": {"type": "keyword"},
                "created_at": {"type": "date"},
                "status": {"type": "keyword"},
                "is_archived": {"type": "boolean"},
                "categories": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                        "path": {
                            "type": "nested",
                            "properties": {
                                "id": {"type": "long"},
                                "name": {"type": "keyword"},
                            },
                        },
                        "assignable": {"type": "boolean"},
                        "disabled": {"type": "boolean"},
                    },
                },
                "groups": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                    },
                },
                "users": {
                    "type": "nested",
                    "properties": {
                        "id": {"type": "keyword"},
                        "username": {"type": "keyword"},
                    },
                },
                "status_log": {
                    "type": "nested",
                    "properties": {
                        "status": {"type": "keyword"},
                        "message": {"type": "keyword"},
                        "updated_by": {"type": "keyword"},
                        "updated_at": {"type": "date"},
                    },
                },
            },
        )

    async def test_proposal_schema(self):
        await self.assertEsSchema(
            Proposal,
            {
                "batch_id": {"type": "long"},
                "batch_name": {"type": "keyword"},
                "file_name": {"type": "keyword"},
                "created_by": {"type": "keyword"},
                "created_at": {"type": "date"},
                "is_archived": {"type": "boolean"},
                "identifier_type": {"type": "keyword"},
                "identifier_value": {"type": "keyword"},
                "reason_message": {"type": "keyword"},
                "category": {
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                        "path": {
                            "type": "nested",
                            "properties": {
                                "id": {"type": "long"},
                                "name": {"type": "keyword"},
                            },
                        },
                        "assignable": {"type": "boolean"},
                        "disabled": {"type": "boolean"},
                    }
                },
                "project": {
                    "properties": {
                        "id": {"type": "long"},
                        "name": {"type": "keyword"},
                        "created_by": {"type": "keyword"},
                        "status": {"type": "keyword"},
                        "is_archived": {"type": "boolean"},
                    }
                },
                "status": {"type": "keyword"},
                "eligibility_status": {"type": "keyword"},
                "status_log": {
                    "type": "nested",
                    "properties": {
                        "status": {"type": "keyword"},
                        "message": {"type": "keyword"},
                        "updated_by": {"type": "keyword"},
                        "updated_at": {"type": "date"},
                    },
                },
            },
        )


class TestIndexExtendPropertiesModel(TestIndexBase):
    context = TestIndexSchemaContext(False)

    async def asyncSetUp(self):
        await self.context.setUp()

        self.context.mock_client.indices.get_mapping.assert_not_awaited()
        self.context.mock_client.indices.create.assert_not_awaited()
        self.context.mock_client.indices.put_mapping.assert_not_awaited()

        self.maxDiff = None

    async def test_extend_properties_model(self):
        class TestAdditionalProperties(AdditionalProperties):
            pass

        class TestModel(IndexerModel):
            class ESConfig:
                index = "test_index"

            id: int
            name: str
            description: str | None
            properties: TestAdditionalProperties | None

        class ExtraField(IndexerNestedModel):
            name: str

        TestAdditionalProperties.add_fields(
            extra_field=(ExtraField, None),
            extra_list_field=(List[ExtraField], None),
            another_title=(str, None),
        )

        await setup_mappings()

        await self.assertEsSchema(
            TestModel,
            {
                "name": {"type": "keyword"},
                "description": {"type": "keyword"},
                "properties": {
                    "properties": {
                        "another_title": {"type": "keyword"},
                        "extra_field": {
                            "properties": {"name": {"type": "keyword"}}
                        },
                        "extra_list_field": {
                            "type": "nested",
                            "properties": {"name": {"type": "keyword"}},
                        },
                    }
                },
            },
        )
