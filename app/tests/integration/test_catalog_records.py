from definitions.catalog_record import CatalogRecordStatus
from repositories.models.catalog_record import (
    CatalogRecordModel,
    CatalogRecordStatusLogModel,
)
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
        ]
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
        ]
    ),
    ReindexRequest(
        CatalogRecordModel,
        CatalogRecord,
        ["MZK01-1", "MZK01-2", "MZK01-3", "MZK01-4"],
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

    async def test_sync_wo_params(self):
        self.assertResponse(
            await self.client.post(
                "/catalog-records/sync",
                json={
                    "query": {"match_all": {}},
                },
            ),
            400,
            {"detail": "At least one sync parameter must be enabled."},
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
