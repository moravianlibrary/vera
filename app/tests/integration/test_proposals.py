from definitions.proposal import ProposalStatus
from repositories.models.project import ProjectModel
from repositories.models.proposal import ProposalBatchModel, ProposalModel
from repositories.models.task import TaskModel
from schemas.proposal import Proposal
from tests.integration.case import (
    EntitySeed,
    SequenceSyncRequest,
    TestIntegrationCase,
)

TEST_DATA_SEED = [
    EntitySeed(
        [ProjectModel(id=1, name="Test Project", created_by="some_user")]
    ),
    EntitySeed(
        [
            ProposalBatchModel(
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
            ProposalModel(
                id=i,
                batch_id=1 if i <= 4 else 2,
                identifier_type="ISXN",
                identifier_value=f"978-3-16-148410-{i}",
                status=[
                    ProposalStatus.Enqueued,
                    ProposalStatus.Pending,
                    ProposalStatus.Accepted,
                    ProposalStatus.Declined,
                ][i % 4],
            )
            for i in range(1, 7)
        ],
        Proposal,
    ),
    SequenceSyncRequest(ProposalBatchModel.__table__, 3),
    SequenceSyncRequest(ProposalModel.__table__, 7),
]


class TestIntegrationProposals(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/search", json={"query": {"match_all": {}}}
            ),
            200,
            {
                "_shards": {
                    "failed": 0,
                    "skipped": 0,
                    "successful": 1,
                    "total": 1,
                },
                "aggregations": None,
                "hits": {
                    "hits": [
                        {
                            "_id": "1",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-1",
                                "justification": None,
                                "project": None,
                                "status": "Pending",
                                "status_log": [],
                            },
                        },
                        {
                            "_id": "2",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-2",
                                "justification": None,
                                "project": None,
                                "status": "Accepted",
                                "status_log": [],
                            },
                        },
                        {
                            "_id": "3",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-3",
                                "justification": None,
                                "project": None,
                                "status": "Declined",
                                "status_log": [],
                            },
                        },
                        {
                            "_id": "4",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 1,
                                "batch_name": "Batch 1",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "id-1",
                                "eligibility_status": None,
                                "file_name": "batch_1.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-4",
                                "justification": None,
                                "project": None,
                                "status": "Enqueued",
                                "status_log": [],
                            },
                        },
                        {
                            "_id": "5",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 2,
                                "batch_name": "Batch 2",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "superuser",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-5",
                                "justification": None,
                                "project": None,
                                "status": "Pending",
                                "status_log": [],
                            },
                        },
                        {
                            "_id": "6",
                            "_index": "proposals",
                            "_score": 1.0,
                            "_source": {
                                "batch_id": 2,
                                "batch_name": "Batch 2",
                                "created_at": "2025-08-22T08:20:09.918106",
                                "created_by": "superuser",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-6",
                                "justification": None,
                                "project": None,
                                "status": "Accepted",
                                "status_log": [],
                            },
                        },
                    ],
                    "max_score": 1.0,
                    "total": {"relation": "eq", "value": 6},
                },
                "timed_out": False,
                "took": 5,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
            },
        )

    async def test_ingest_new_batch(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "justification": "Justification text",
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
                    "task_type": "Proposal.Ingest",
                    "task_scope": "Proposal",
                    "unscoped_task_type": "Ingest",
                    "name": "Ingest proposals",
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
                "/proposals/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                    }
                ],
                params={"batch_id": 2},
            ),
            200,
            {
                "batch_id": 2,
                "task": {
                    "id": 1,
                    "task_type": "Proposal.Ingest",
                    "task_scope": "Proposal",
                    "unscoped_task_type": "Ingest",
                    "name": "Ingest proposals",
                    "task_schedule_id": None,
                    "created_by": "superuser",
                    "has_query": False,
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
            },
            exclude_paths={("task", "created_at")},
        )

    async def test_fail_on_ingest_with_ambiguous_batch_params(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/ingest",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
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
                "/proposals/reingest",
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Proposal.Reingest",
                "task_scope": "Proposal",
                "unscoped_task_type": "Reingest",
                "name": "Reingest proposals",
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
            TaskModel,
            1,
            {
                "query": {"query": {"term": {"_id": "1"}}},
            },
        )

    async def test_approve(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/approve",
                json={"query": {"term": {"_id": "1"}}},
                params={"category_id": 1},
            ),
            200,
            {
                "id": 1,
                "task_type": "Proposal.Approve",
                "task_scope": "Proposal",
                "unscoped_task_type": "Approve",
                "name": "Approve proposals",
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
                "data": {
                    "batch_id": 3,
                    "settings": {
                        "category_id": 1,
                        "priority": 3,
                        "allow_new_iteration": False,
                        "ignore_digitization_check": False,
                    },
                },
            },
        )

    async def test_reject(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/reject",
                json={"query": {"term": {"_id": "1"}}},
                params={"message": "Not a valid proposal"},
            ),
            200,
            {
                "id": 1,
                "task_type": "Proposal.Reject",
                "task_scope": "Proposal",
                "unscoped_task_type": "Reject",
                "name": "Reject proposals",
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
                "data": {"message": "Not a valid proposal"},
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.post(
                "/proposals/delete",
                json={"query": {"term": {"_id": "1"}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Proposal.Delete",
                "task_scope": "Proposal",
                "unscoped_task_type": "Delete",
                "name": "Delete proposals",
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
