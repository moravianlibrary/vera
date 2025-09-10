from repositories.models.catalog_record import CatalogRecordModel
from repositories.models.category import CategoryModel
from repositories.models.document import DocumentIterationModel, DocumentModel
from repositories.models.task import TaskModel
from repositories.models.watchlist import WatchlistModel
from schemas.document import Document
from tests.integration.case import EntitySeed, TestIntegrationCase

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"

TEST_DATA = [
    EntitySeed(
        CatalogRecordModel(
            id="MZK01-1",
            base="MZK01",
            system_number="1",
            marc=TEST_MARC_BYTES,
            material_type="Book",
        )
    ),
    EntitySeed(
        [
            DocumentModel(id=id, catalog_record_id="MZK01-1", page_count=13)
            for id in range(1, 5)
        ],
    ),
    EntitySeed(
        CategoryModel(
            id=1,
            name="Category 1",
            description="Description for Category 1",
            level=1,
            assignable=True,
            extract_whole=False,
        )
    ),
    EntitySeed(
        [
            DocumentIterationModel(
                id=id,
                document_id=id if id <= 4 else 1,
                iteration=1 if id <= 4 else 2,
                category_id=1,
                created_by="test_user",
            )
            for id in range(1, 6)
        ],
        Document,
    ),
]


class TestIntegrationDocuments(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/documents/search",
                json={
                    "query": {"match_all": {}},
                    "sort": [{"created_at": {"order": "asc"}}],
                },
            ),
            200,
            {
                "_shards": {
                    "failed": 0,
                    "skipped": 0,
                    "successful": 1,
                    "total": 1,
                },
                "took": "any int",
                "timed_out": False,
                "hits": {
                    "max_score": None,
                    "hits": [
                        {
                            "_id": "2",
                            "_index": "documents",
                            "_score": None,
                            "_source": {
                                "catalog_record_id": "MZK01-1",
                                "catalog_record_valid": False,
                                "category_id": 1,
                                "created_by": "test_user",
                                "current_status": [
                                    "CannotBeExtracted",
                                    "CatalogRecordSynced",
                                    "CatalogRecordInvalid",
                                ],
                                "digitization_records": [],
                                "digitization_state": ["Unknown"],
                                "iteration": 1,
                                "iteration_id": 2,
                                "material_type": "Book",
                                "page_count": 13,
                                "priority": 3,
                                "properties": {},
                                "updated_at": "2025-09-10T15:33:16.854192",
                                "watchlists": [],
                            },
                        },
                        {
                            "_id": "3",
                            "_index": "documents",
                            "_score": None,
                            "_source": {
                                "catalog_record_id": "MZK01-1",
                                "catalog_record_valid": False,
                                "category_id": 1,
                                "created_by": "test_user",
                                "current_status": [
                                    "CannotBeExtracted",
                                    "CatalogRecordSynced",
                                    "CatalogRecordInvalid",
                                ],
                                "digitization_records": [],
                                "digitization_state": ["Unknown"],
                                "iteration": 1,
                                "iteration_id": 3,
                                "material_type": "Book",
                                "page_count": 13,
                                "priority": 3,
                                "properties": {},
                                "updated_at": "2025-09-10T15:33:16.854192",
                                "watchlists": [],
                            },
                        },
                        {
                            "_id": "4",
                            "_index": "documents",
                            "_score": None,
                            "_source": {
                                "catalog_record_id": "MZK01-1",
                                "catalog_record_valid": False,
                                "category_id": 1,
                                "created_by": "test_user",
                                "current_status": [
                                    "CannotBeExtracted",
                                    "CatalogRecordSynced",
                                    "CatalogRecordInvalid",
                                ],
                                "digitization_records": [],
                                "digitization_state": ["Unknown"],
                                "iteration": 1,
                                "iteration_id": 4,
                                "material_type": "Book",
                                "page_count": 13,
                                "priority": 3,
                                "properties": {},
                                "updated_at": "2025-09-10T15:33:16.854192",
                                "watchlists": [],
                            },
                        },
                        {
                            "_id": "1",
                            "_index": "documents",
                            "_score": None,
                            "_source": {
                                "catalog_record_id": "MZK01-1",
                                "catalog_record_valid": False,
                                "category_id": 1,
                                "created_by": "test_user",
                                "current_status": [
                                    "CannotBeExtracted",
                                    "CatalogRecordSynced",
                                    "CatalogRecordInvalid",
                                ],
                                "digitization_records": [],
                                "digitization_state": ["Unknown"],
                                "iteration": 2,
                                "iteration_id": 5,
                                "material_type": "Book",
                                "page_count": 13,
                                "priority": 3,
                                "properties": {},
                                "updated_at": "2025-09-10T15:33:16.854192",
                                "watchlists": [],
                            },
                        },
                    ],
                    "total": {"relation": "eq", "value": 4},
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
                ("hits", "hits", "_source", "updated_at"),
            },
        )

    async def test_csv_export(self):
        response = await self.client.post(
            "/documents/export",
            params={"export_format": "csv"},
            json={
                "query": {"match_all": {}},
                "sort": [{"created_at": {"order": "asc"}}],
                "_source": ["catalog_record_id", "barcode"],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["content-type"], "text/csv; charset=utf-8"
        )
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="vera-documents.csv"',
        )
        self.assertEqual(
            response.text,
            (
                "catalog_record_id,barcode\n"
                "MZK01-1,\n"
                "MZK01-1,\n"
                "MZK01-1,\n"
                "MZK01-1,\n"
            ),
        )

    async def test_generate_list(self):
        self.assertResponse(
            await self.client.post(
                "/documents/generate-list",
                json={"query": {"match_all": {}}},
                params={"target_page_count": 10000},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.GenerateList",
                "task_scope": "Document",
                "unscoped_task_type": "GenerateList",
                "name": "Generate list from documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )

    async def test_update_page_count(self):
        self.assertResponse(
            await self.client.patch(
                "/documents/1/page-count",
                params={"page_count": 20},
            ),
            200,
            {"document_id": 1, "iterations_updated": 2, "new_page_count": 20},
        )
        self.assertEntityProperties(
            DocumentModel,
            1,
            {"page_count": 20},
        )

    async def test_update_page_count_invalid(self):
        self.assertResponse(
            await self.client.patch(
                "/documents/1/page-count",
                params={"page_count": -5},
            ),
            422,
            {
                "detail": [
                    {
                        "type": "greater_than_equal",
                        "loc": ["query", "page_count"],
                        "msg": "Input should be greater than or equal to 1",
                        "input": "-5",
                        "ctx": {"ge": 1},
                    }
                ]
            },
        )

    async def test_update_page_count_nonexistent(self):
        self.assertResponse(
            await self.client.patch(
                "/documents/999/page-count",
                params={"page_count": 10},
            ),
            404,
            {"detail": "Document with ID '999' not found."},
        )

    async def test_set_category(self):
        self.assertResponse(
            await self.client.post(
                "/documents/category",
                json={"query": {"term": {"_id": "1"}}},
                params={"category_id": 1},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.SetCategory",
                "task_scope": "Document",
                "unscoped_task_type": "SetCategory",
                "name": "Set category for documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
                "data": {"category_id": 1},
            },
        )

    async def test_set_priority(self):
        self.assertResponse(
            await self.client.post(
                "/documents/priority",
                json={"query": {"term": {"_id": "1"}}},
                params={"priority": 4},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.SetPriority",
                "task_scope": "Document",
                "unscoped_task_type": "SetPriority",
                "name": "Set priority for documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
                "data": {"priority": 4},
            },
        )

    async def test_set_digitization_decision(self):
        self.assertResponse(
            await self.client.post(
                "/documents/digitization-decision",
                json={"query": {"term": {"_id": "1"}}},
                params={"decline": True},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.SetDigitizationDecision",
                "task_scope": "Document",
                "unscoped_task_type": "SetDigitizationDecision",
                "name": "Set digitization decision for documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
                "data": {"decline": True},
            },
        )

    async def test_reindex(self):
        self.assertResponse(
            await self.client.post(
                "/documents/reindex",
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.Reindex",
                "task_scope": "Document",
                "unscoped_task_type": "Reindex",
                "name": "Reindex documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {"query": {"query": {"term": {"_id": "1"}}}},
        )

    async def test_sync(self):
        self.assertResponse(
            await self.client.post(
                "/documents/sync",
                params={"catalog_record": True, "properties": True},
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.Sync",
                "task_scope": "Document",
                "unscoped_task_type": "Sync",
                "name": "Sync documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {"query": {"query": {"term": {"_id": "1"}}}},
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.post(
                "/documents/delete",
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Document.Delete",
                "task_scope": "Document",
                "unscoped_task_type": "Delete",
                "name": "Delete documents",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-09T15:02:03.474003",
                "started_at": None,
                "finished_at": None,
                "total_count": 0,
                "processed_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
            },
        )

    async def test_create_watchlist(self):
        self.assertResponse(
            await self.client.post(
                "/documents/watchlist",
                params={
                    "name": "Watchlist 1",
                    "description": "Description for Watchlist 1",
                },
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "name": "Watchlist 1",
                "description": "Description for Watchlist 1",
                "query": {"query": {"term": {"_id": "1"}}},
                "subscriptions": [],
                "target": "Documents",
            },
        )
        self.assertEntityProperties(
            WatchlistModel,
            1,
            {
                "name": "Watchlist 1",
                "description": "Description for Watchlist 1",
                "target": "Documents",
                "query": {"query": {"term": {"_id": "1"}}},
            },
        )
