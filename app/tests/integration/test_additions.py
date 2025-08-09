from unittest import skip  # noF

from definitions.addition import AdditionStatus
from repositories.models.addition import AdditionBatchModel, AdditionModel
from repositories.models.user import UserModel
from schemas.addition import Addition
from tests.integration.case import EntitySeed, TestIntegrationCase

TEST_DATA = [
    EntitySeed(
        entities=[
            UserModel(
                id=f"id-{i}", username=f"user{i}", email=f"user{i}@mzk.cz"
            )
            for i in range(1, 4)
        ]
    ),
    EntitySeed(
        entities=[
            AdditionBatchModel(
                id=i,
                name=f"Batch {i}",
                file_name=f"batch_{i}.json",
                created_by=f"id-{i}",
            )
            for i in range(1, 3)
        ]
    ),
    EntitySeed(
        entities=[
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
        indexer_model=Addition,
    ),
]


# @skip
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
                                "is_archived": False,
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
                                "is_archived": False,
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
                                "is_archived": False,
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
                                "is_archived": False,
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
                                "created_by": "id-2",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-5",
                                "ignore_digitization_check": False,
                                "is_archived": False,
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
                                "created_by": "id-2",
                                "eligibility_status": None,
                                "file_name": "batch_2.json",
                                "identifier_type": "ISXN",
                                "identifier_value": "978-3-16-148410-6",
                                "ignore_digitization_check": True,
                                "is_archived": False,
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
