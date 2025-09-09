from definitions.catalog_record import CatalogRecordStatus
from repositories.models.catalog_record import (
    CatalogRecordModel,
    CatalogRecordStatusLogModel,
)
from repositories.models.task import TaskModel
from schemas.catalog_record import CatalogRecord
from tests.integration.case import (
    EntitySeed,
    ReindexRequest,
    TestIntegrationCase,
)

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"

TEST_DATA = [
    EntitySeed(
        [
            CatalogRecordModel(
                id="MZK01-1",
                base="MZK01",
                system_number="1",
                marc=TEST_MARC_BYTES,
                material_type="Book",
            ),
            CatalogRecordModel(
                id="MZK01-2",
                base="MZK01",
                system_number="2",
                marc=TEST_MARC_BYTES,
                material_type="Book",
                has_added_documents=True,
                is_valid=True,
                force_valid=True,
            ),
            CatalogRecordModel(
                id="MZK01-3",
                base="MZK01",
                system_number="3",
                marc=TEST_MARC_BYTES,
                material_type="Book",
                in_review=True,
            ),
            CatalogRecordModel(
                id="MZK01-4",
                base="MZK01",
                system_number="4",
                marc=TEST_MARC_BYTES,
                material_type="Book",
                archived=True,
            ),
        ],
    ),
    EntitySeed(
        [
            CatalogRecordStatusLogModel(
                catalog_record_id="MZK01-2",
                status=CatalogRecordStatus.ForceValid,
                created_by="superuser",
                message="Because I said so",
            ),
            CatalogRecordStatusLogModel(
                catalog_record_id="MZK01-2",
                status=CatalogRecordStatus.Valid,
                created_by="VeraBot",
                message="Valid after force valid",
            ),
            CatalogRecordStatusLogModel(
                catalog_record_id="MZK01-3",
                status=CatalogRecordStatus.MarkInReview,
                created_by="superuser",
            ),
        ],
    ),
    ReindexRequest(
        CatalogRecordModel, CatalogRecord, [f"MZK01-{i}" for i in range(1, 5)]
    ),
]


class TestIntegrationCatalogRecords(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/search",
                json={
                    "query": {"match_all": {}},
                    "sort": [{"updated_at": {"order": "asc"}}],
                },
            ),
            200,
            {
                "took": 21,
                "timed_out": False,
                "_shards": {
                    "total": 1,
                    "successful": 1,
                    "skipped": 0,
                    "failed": 0,
                },
                "hits": {
                    "total": {"value": 4, "relation": "eq"},
                    "max_score": None,
                    "hits": [
                        {
                            "_index": "catalog_records",
                            "_id": "MZK01-1",
                            "_score": None,
                            "_source": {
                                "base": "MZK01",
                                "system_number": "1",
                                "material_type": "Book",
                                "title": None,
                                "subtitle": None,
                                "identifiers": [],
                                "force_valid": False,
                                "is_valid": False,
                                "current_status": ["Synced", "Invalid"],
                                "properties": {},
                                "updated_at": "2025-08-11T14:26:23.868322",
                                "watchlists": [],
                            },
                        },
                        {
                            "_index": "catalog_records",
                            "_id": "MZK01-2",
                            "_score": None,
                            "_source": {
                                "base": "MZK01",
                                "system_number": "2",
                                "material_type": "Book",
                                "title": None,
                                "subtitle": None,
                                "identifiers": [],
                                "force_valid": True,
                                "is_valid": True,
                                "current_status": [
                                    "Synced",
                                    "Valid",
                                    "ForceValid",
                                ],
                                "properties": {},
                                "updated_at": "2025-08-11T14:26:23.868322",
                                "watchlists": [],
                            },
                        },
                        {
                            "_index": "catalog_records",
                            "_id": "MZK01-3",
                            "_score": None,
                            "_source": {
                                "base": "MZK01",
                                "system_number": "3",
                                "material_type": "Book",
                                "title": None,
                                "subtitle": None,
                                "identifiers": [],
                                "force_valid": False,
                                "is_valid": False,
                                "current_status": [
                                    "Synced",
                                    "Invalid",
                                    "MarkInReview",
                                ],
                                "properties": {},
                                "updated_at": "2025-08-11T14:26:23.868322",
                                "watchlists": [],
                            },
                        },
                        {
                            "_index": "catalog_records",
                            "_id": "MZK01-4",
                            "_score": None,
                            "_source": {
                                "base": "MZK01",
                                "system_number": "4",
                                "material_type": "Book",
                                "title": None,
                                "subtitle": None,
                                "identifiers": [],
                                "force_valid": False,
                                "is_valid": False,
                                "current_status": [
                                    "Synced",
                                    "Invalid",
                                    "Archived",
                                ],
                                "properties": {},
                                "updated_at": "2025-08-11T14:26:23.868322",
                                "watchlists": [],
                            },
                        },
                    ],
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "updated_at"),
            },
        )

    async def test_get_details(self):
        self.assertResponse(
            await self.client.get("/catalog-records/MZK01-1/details"),
            200,
            {
                "id": "MZK01-1",
                "marc": {
                    "leader": "00048    a2200037   4500",
                    "control_fields": {"001": "000121929"},
                    "variable_fields": {},
                },
                "validity_sources": [],
                "additional_details": None,
                "status_log": [],
            },
        )

    async def test_get_details_with_status_log(self):
        self.assertResponse(
            await self.client.get("/catalog-records/MZK01-2/details"),
            200,
            {
                "id": "MZK01-2",
                "marc": {
                    "leader": "00048    a2200037   4500",
                    "control_fields": {"001": "000121929"},
                    "variable_fields": {},
                },
                "validity_sources": [],
                "additional_details": None,
                "status_log": [
                    {
                        "status": "ForceValid",
                        "message": "Because I said so",
                        "created_by": "superuser",
                        "created_at": "2025-08-11T14:46:22.200514",
                    },
                    {
                        "status": "Valid",
                        "message": "Valid after force valid",
                        "created_by": "VeraBot",
                        "created_at": "2025-08-11T14:46:22.200514",
                    },
                ],
            },
            exclude_paths={("status_log", "created_at")},
        )

    async def test_reindex(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/reindex", json={"query": {"match_all": {}}}
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.Reindex",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "Reindex",
                "name": "Reindex catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": None,
            },
        )

    async def test_schedule_reindex(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/reindex",
                json={"query": {"match_all": {}}},
                params={
                    "schedule_name": "Reindex catalog records every midnight",
                    "cron_expression": "0 0 * * *",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Reindex catalog records every midnight",
                "cron_expression": "0 0 * * *",
                "task_type": "CatalogRecord.Reindex",
                "query": {"query": {"match_all": {}}},
                "data": None,
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "Reindex",
            },
        )

    async def test_sync(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/sync",
                json={
                    "query": {"match_all": {}},
                },
                params={"from_catalog": True},
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.Sync",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "Sync",
                "name": "Sync catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": {"from_catalog": True, "properties": False},
            },
        )

    async def test_sync_wo_params(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/sync",
                json={
                    "query": {"match_all": {}},
                },
            ),
            400,
            {
                "detail": "No synchronization target selected. "
                "Enable 'from_catalog' to sync documents from the catalog, "
                "or 'properties' to sync additional properties."
            },
        )

    async def test_schedule_sync(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/sync",
                json={
                    "query": {"match_all": {}},
                },
                params={
                    "from_catalog": True,
                    "properties": True,
                    "schedule_name": "Sync catalog records once a month",
                    "cron_expression": "0 0 1 * *",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Sync catalog records once a month",
                "cron_expression": "0 0 1 * *",
                "task_type": "CatalogRecord.Sync",
                "query": {"query": {"match_all": {}}},
                "data": {"from_catalog": True, "properties": True},
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "Sync",
            },
        )

    async def test_set_forced_validity(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/forced-validity",
                json={
                    "query": {"match_all": {}},
                },
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.SetForcedValidity",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "SetForcedValidity",
                "name": "Set forced validity for catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": {"validity": True},
            },
        )

    async def test_unset_forced_validity(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/forced-validity",
                json={
                    "query": {"match_all": {}},
                },
                params={"validity": False},
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.SetForcedValidity",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "SetForcedValidity",
                "name": "Reset forced validity for catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": {"validity": False},
            },
        )

    async def test_mark_in_review(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/mark-in-review",
                json={
                    "query": {"match_all": {}},
                },
                params={"message": "Marking as in review"},
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.MarkInReview",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "MarkInReview",
                "name": "Mark catalog records as in review",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": {"in_review": True, "message": "Marking as in review"},
            },
        )

    async def test_unmark_in_review(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/mark-in-review",
                json={
                    "query": {"match_all": {}},
                },
                params={"in_review": False},
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.MarkInReview",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "MarkInReview",
                "name": "Unmark catalog records as in review",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"match_all": {}}},
                "data": {"in_review": False, "message": None},
            },
        )

    async def test_archive_inactive(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/archive-inactive",
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.ArchiveInactive",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "ArchiveInactive",
                "name": "Archive inactive catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": False,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel, 1, {"query": None, "data": None}
        )

    async def test_schedule_archive_inactive(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/archive-inactive",
                params={
                    "schedule_name": (
                        "Archive inactive catalog records at midnight"
                    ),
                    "cron_expression": "0 0 * * *",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Archive inactive catalog records at midnight",
                "cron_expression": "0 0 * * *",
                "task_type": "CatalogRecord.ArchiveInactive",
                "query": None,
                "data": None,
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "ArchiveInactive",
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/delete",
                json={
                    "query": {"match_all": {}},
                },
            ),
            200,
            {
                "id": 1,
                "task_type": "CatalogRecord.Delete",
                "task_scope": "CatalogRecord",
                "unscoped_task_type": "Delete",
                "name": "Delete catalog records",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-11T15:38:49.321818",
                "started_at": None,
                "finished_at": None,
                "processed_count": 0,
                "total_count": 0,
                "error_count": 0,
                "result": None,
            },
            exclude_paths={("created_at",)},
        )
        self.assertEntityProperties(
            TaskModel, 1, {"query": {"query": {"match_all": {}}}, "data": None}
        )
