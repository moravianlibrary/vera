from definitions.digitization_registry import DigitizationListState
from repositories.models.catalog_record import CatalogRecordModel
from repositories.models.category import CategoryModel
from repositories.models.digitization_list import DigitizationListModel
from repositories.models.document import DocumentIterationModel, DocumentModel
from repositories.models.intention import IntentionModel
from repositories.models.task import TaskModel
from schemas.digitization_list import DigitizationList
from schemas.document import Document
from tests.integration.case import (
    EntitySeed,
    ReindexRequest,
    TestIntegrationCase,
)

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"

TEST_DATA_SEED = [
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
            IntentionModel(
                id=i,
                name=f"Intention {i}",
            )
            for i in range(1, 3)
        ]
    ),
    EntitySeed(
        [
            DigitizationListModel(
                id=1,
                state=DigitizationListState.InProgress,
                created_by="test_user",
            ),
            DigitizationListModel(
                id=2,
                state=DigitizationListState.Planned,
                created_by="test_user",
            ),
        ]
    ),
    EntitySeed(
        [
            DocumentIterationModel(
                id=id,
                document_id=id if id <= 4 else 1,
                iteration=1 if id <= 4 else 2,
                category_id=1,
                created_by="test_user",
                digitization_list_id={1: 1, 2: 1, 5: 2}.get(id),
            )
            for id in range(1, 6)
        ],
        Document,
    ),
    ReindexRequest(DigitizationListModel, DigitizationList, [1, 2]),
]


class TestIntegrationDigitizationLists(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists/search",
                json={
                    "query": {"match_all": {}},
                    "sort": [
                        {"created_at": {"order": "asc"}},
                    ],
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
                    "hits": [
                        {
                            "_id": "1",
                            "_index": "digitization_lists",
                            "_score": None,
                            "_source": {
                                "count_documents": 2,
                                "count_pages": 26,
                                "created_by": "test_user",
                                "intentions": [],
                                "state": "InProgress",
                            },
                        },
                        {
                            "_id": "2",
                            "_index": "digitization_lists",
                            "_score": None,
                            "_source": {
                                "count_documents": 1,
                                "count_pages": 13,
                                "created_by": "test_user",
                                "intentions": [],
                                "state": "Planned",
                            },
                        },
                    ],
                    "max_score": None,
                    "total": {"relation": "eq", "value": 2},
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
            },
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists",
                json={"query": {"ids": {"values": ["3"]}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.Create",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "Create",
                "name": "Create digitization list",
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
                "query": {"query": {"ids": {"values": ["3"]}}},
                "data": {
                    "state": "InProgress",
                    "intention_ids": [],
                    "skip_state_validation_for": [],
                },
            },
        )

    async def test_create_with_params(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists",
                json={
                    "query": {"match_all": {}},
                },
                params={
                    "state": "Planned",
                    "intention_ids": [1],
                    "skip_state_validation_for": ["Planned"],
                },
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.Create",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "Create",
                "name": "Create digitization list",
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
                "data": {
                    "state": "Planned",
                    "intention_ids": [1],
                    "skip_state_validation_for": ["Planned"],
                },
            },
        )

    async def test_change_state(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists/1/state",
                json={"state": "Finished"},
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.ChangeState",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "ChangeState",
                "name": "Change digitization list state",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": False,
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
                "data": {"digitization_list_id": 1, "state": "Finished"},
            },
        )

    async def test_change_intentions(self):
        self.assertResponse(
            await self.client.patch(
                "/digitization-lists/1/intentions",
                params={"intention_ids": [1, 2]},
            ),
            200,
            {
                "id": 1,
                "state": "InProgress",
                "intentions": [
                    {"id": 1, "name": "Intention 1"},
                    {"id": 2, "name": "Intention 2"},
                ],
                "count_documents": 2,
                "count_pages": 26,
                "created_at": "2025-08-21T12:03:23.638059",
                "created_by": "test_user",
            },
            exclude_paths={("created_at",)},
        )

    async def test_add_documents(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists/1/add-documents",
                json={"query": {"match_all": {}}},
                params={
                    "skip_state_validation_for": [
                        "Revision",
                        "Planned",
                        "NotAvailable",
                    ]
                },
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.AddDocuments",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "AddDocuments",
                "name": "Add documents to digitization list",
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
                "data": {
                    "digitization_list_id": 1,
                    "skip_state_validation_for": [
                        "Revision",
                        "Planned",
                        "NotAvailable",
                    ],
                },
            },
        )

    async def test_remove_documents(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists/1/remove-documents",
                json={"query": {"match_all": {}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.RemoveDocuments",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "RemoveDocuments",
                "name": "Remove documents from digitization list",
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
                "data": {"digitization_list_id": 1},
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.post(
                "/digitization-lists/1/delete",
            ),
            200,
            {
                "id": 1,
                "task_type": "DigitizationList.Delete",
                "task_scope": "DigitizationList",
                "unscoped_task_type": "Delete",
                "name": "Delete digitization list",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": False,
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
                "data": {"digitization_list_id": 1},
            },
        )
