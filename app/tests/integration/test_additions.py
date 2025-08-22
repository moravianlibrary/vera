from definitions.addition import AdditionStatus
from repositories.models.addition import AdditionBatchModel, AdditionModel
from repositories.models.category import CategoryModel
from repositories.models.task import TaskModel
from repositories.models.user import UserModel
from schemas.addition import Addition
from tests.integration.case import (
    EntitySeed,
    SequenceSyncRequest,
    TestIntegrationCase,
)

TEST_DATA = [
    EntitySeed(
        [
            UserModel(
                id=f"id-{i}", username=f"user{i}", email=f"user{i}@mzk.cz"
            )
            for i in range(1, 4)
        ],
    ),
    EntitySeed(
        UserModel(
            id="superuser", username="superuser", email="superuser@mzk.cz"
        )
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
            AdditionBatchModel(
                id=i,
                name=f"Batch {i}",
                file_name=f"batch_{i}.json",
                created_by="id-1" if i == 1 else "superuser",
            )
            for i in range(1, 3)
        ],
    ),
    EntitySeed(
        [
            AdditionModel(
                id=i,
                batch_id=1 if i <= 4 else 2,
                identifier_type="ISXN",
                identifier_value=f"978-3-16-148410-{i}",
                category_id=1,
                priority=(i % 5) + 1,
                allow_new_iteration=i % 2 == 0,
                ignore_digitization_check=i % 3 == 0,
                status=[
                    AdditionStatus.Enqueued,
                    AdditionStatus.NotEligibleForAddition,
                    AdditionStatus.Completed,
                ][i % 3],
            )
            for i in range(1, 7)
        ],
        Addition,
    ),
    SequenceSyncRequest(AdditionBatchModel.__table__, 3),
    SequenceSyncRequest(AdditionModel.__table__, 7),
]


class TestIntegrationAdditions(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/additions/search",
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
                    "total": {"value": 6, "relation": "eq"},
                    "max_score": None,
                    "hits": [
                        {
                            "_id": "1",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": False,
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "category_id": 1,
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-1",
                                "ignore_digitization_check": False,
                                "priority": 2,
                                "project": None,
                                "proposal": None,
                                "status": "NotEligibleForAddition",
                            },
                        },
                        {
                            "_id": "2",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": True,
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "category_id": 1,
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-2",
                                "ignore_digitization_check": False,
                                "priority": 3,
                                "project": None,
                                "proposal": None,
                                "status": "Completed",
                            },
                        },
                        {
                            "_id": "3",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": False,
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "category_id": 1,
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-3",
                                "ignore_digitization_check": True,
                                "priority": 4,
                                "project": None,
                                "proposal": None,
                                "status": "Enqueued",
                            },
                        },
                        {
                            "_id": "4",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": True,
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "category_id": 1,
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-4",
                                "ignore_digitization_check": False,
                                "priority": 5,
                                "project": None,
                                "proposal": None,
                                "status": "NotEligibleForAddition",
                            },
                        },
                        {
                            "_id": "5",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": False,
                                "batch_id": 2,
                                "batch_name": "Batch 2",
                                "category_id": 1,
                                "created_by": "superuser",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-5",
                                "ignore_digitization_check": False,
                                "priority": 1,
                                "project": None,
                                "proposal": None,
                                "status": "Completed",
                            },
                        },
                        {
                            "_id": "6",
                            "_index": "additions",
                            "_score": None,
                            "_source": {
                                "allow_new_iteration": True,
                                "batch_id": 2,
                                "batch_name": "Batch 2",
                                "category_id": 1,
                                "created_by": "superuser",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-6",
                                "ignore_digitization_check": True,
                                "priority": 2,
                                "project": None,
                                "proposal": None,
                                "status": "Enqueued",
                            },
                        },
                    ],
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
            },
        )

    async def test_ingest_new_batch(self):
        self.assertResponse(
            await self.client.post(
                "/additions/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "category_id": 1,
                        "priority": 2,
                    }
                ],
                params={
                    "file_name": "new_batch.txt",
                },
            ),
            200,
            {
                "batch_id": 3,
                "task": {
                    "id": 1,
                    "task_type": "Addition.Ingest",
                    "task_scope": "Addition",
                    "unscoped_task_type": "Ingest",
                    "name": "Ingest additions",
                    "task_schedule_id": None,
                    "created_by": "superuser",
                    "has_query": False,
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
            },
            exclude_paths={("task", "created_at")},
        )

    async def test_ingest_existing_batch(self):
        self.assertResponse(
            await self.client.post(
                "/additions/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "category_id": 1,
                        "priority": 2,
                    }
                ],
                params={"batch_id": 2},
            ),
            200,
            {
                "batch_id": 2,
                "task": {
                    "id": 1,
                    "task_type": "Addition.Ingest",
                    "task_scope": "Addition",
                    "unscoped_task_type": "Ingest",
                    "name": "Ingest additions",
                    "task_schedule_id": None,
                    "created_by": "superuser",
                    "has_query": False,
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
            },
            exclude_paths={("task", "created_at")},
        )

    async def test_fail_on_ingest_with_ambiguous_batch_params(self):
        self.assertResponse(
            await self.client.post(
                "/additions/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "category_id": 1,
                        "priority": 2,
                    }
                ],
                params={"batch_id": 2, "batch_name": "Test Batch"},
            ),
            422,
            {
                "detail": (
                    "You cannot provide both a batch ID "
                    "and a batch name or file name. "
                    "Please provide only one option."
                )
            },
        )

    async def test_reingest(self):
        self.assertResponse(
            await self.client.post(
                "/additions/reingest",
                json={"query": {"term": {"_id": "1"}}},
                params={"allow_new_iteration": True},
            ),
            200,
            {
                "id": 1,
                "task_type": "Addition.Reingest",
                "task_scope": "Addition",
                "unscoped_task_type": "Reingest",
                "name": "Reingest additions",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": True,
                "task_state": "Initializing",
                "created_at": "2025-08-11T08:34:25.543787",
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
            AdditionModel,
            1,
            {"allow_new_iteration": False, "ignore_digitization_check": False},
        )
        self.assertEntityProperties(
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
                "data": {
                    "allow_new_iteration": True,
                    "ignore_digitization_check": False,
                },
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.post(
                "/additions/delete",
                json={"query": {"term": {"_id": "4"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Addition.Delete",
                "task_scope": "Addition",
                "unscoped_task_type": "Delete",
                "name": "Delete additions",
                "task_schedule_id": None,
                "created_by": "superuser",
                "has_query": True,
                "has_data": False,
                "task_state": "Initializing",
                "created_at": "2025-08-11T08:34:25.543787",
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
            TaskModel, 1, {"query": {"query": {"term": {"_id": "4"}}}}
        )
