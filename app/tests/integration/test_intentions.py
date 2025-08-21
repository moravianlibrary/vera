from definitions.digitization_registry import DigitizationListState
from repositories.models.associations import (
    digitization_list_intention_association,
)
from repositories.models.digitization_list import DigitizationListModel
from repositories.models.intention import IntentionModel
from repositories.models.project import ProjectModel
from schemas.intention import Intention
from tests.integration.case import (
    AssociationSeed,
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
            DigitizationListModel(
                id=1,
                state=DigitizationListState.InProgress,
                created_by="some_user",
            )
        ],
    ),
    EntitySeed(
        [
            IntentionModel(
                id=1,
                name="Test Intention 1",
                description="Test intention 1",
                target_page_count=20000,
                start_date="2025-01-01",
                end_date="2025-12-01",
                project_id=1,
            ),
            IntentionModel(
                id=2,
                name="Test Intention 2",
                description="Test intention 2",
                target_page_count=30000,
                end_date="2028-02-10",
            ),
            IntentionModel(
                id=3,
                name="Test Intention 3",
                description="Test intention 2",
                start_date="2025-01-01",
            ),
        ],
        Intention,
    ),
    AssociationSeed(digitization_list_intention_association, {1: [3]}),
    SequenceSyncRequest(IntentionModel.__table__, 4),
]


class TestIntegrationIntentions(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/intentions/search",
                json={
                    "query": {"match_all": {}},
                    "sort": [{"end_date": {"order": "asc"}}],
                    "size": 10,
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
                "aggregations": None,
                "hits": {
                    "hits": [
                        {
                            "_id": "1",
                            "_index": "intentions",
                            "_score": None,
                            "_source": {
                                "name": "Test Intention 1",
                                "description": "Test intention 1",
                                "target_page_count": 20000,
                                "start_date": "2025-01-01T00:00:00",
                                "end_date": "2025-12-01T00:00:00",
                                "project": {
                                    "id": 1,
                                    "name": "Test Project",
                                    "status": "Proposed",
                                    "created_by": "some_user",
                                    "is_archived": False,
                                },
                                "is_archived": False,
                            },
                        },
                        {
                            "_id": "2",
                            "_index": "intentions",
                            "_score": None,
                            "_source": {
                                "name": "Test Intention 2",
                                "description": "Test intention 2",
                                "target_page_count": 30000,
                                "start_date": None,
                                "end_date": "2028-02-10T00:00:00",
                                "project": None,
                                "is_archived": False,
                            },
                        },
                        {
                            "_id": "3",
                            "_index": "intentions",
                            "_score": None,
                            "_source": {
                                "name": "Test Intention 3",
                                "description": "Test intention 2",
                                "target_page_count": None,
                                "start_date": "2025-01-01T00:00:00",
                                "end_date": None,
                                "project": None,
                                "is_archived": False,
                            },
                        },
                    ],
                    "max_score": None,
                    "total": {"relation": "eq", "value": 3},
                },
                "timed_out": False,
                "took": 14,
            },
            exclude_paths={("took",)},
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/intentions",
                json={
                    "name": "New Intention",
                    "description": "New intention description",
                    "target_page_count": 10000,
                    "start_date": "2025-01-01",
                    "end_date": "2025-12-01",
                },
            ),
            200,
            {
                "id": 4,
                "name": "New Intention",
                "description": "New intention description",
                "target_page_count": 10000,
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-12-01T00:00:00",
                "project": None,
                "is_archived": False,
            },
        )

    async def test_create_fail_on_dates_too_close(self):
        self.assertResponse(
            await self.client.post(
                "/intentions",
                json={
                    "name": "New Intention",
                    "description": "New intention description",
                    "target_page_count": 10000,
                    "start_date": "2025-01-01",
                    "end_date": "2024-12-01",
                },
            ),
            400,
            {
                "detail": (
                    "The end date must be at least 7 days "
                    "after the start date."
                )
            },
        )

    async def test_update(self):
        self.assertResponse(
            await self.client.put(
                "/intentions/1",
                json={
                    "name": "Updated Intention",
                    "description": "Updated intention description",
                    "target_page_count": 15000,
                    "start_date": "2025-01-01",
                    "end_date": "2025-12-01",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Updated Intention",
                "description": "Updated intention description",
                "target_page_count": 15000,
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-12-01T00:00:00",
                "project": {
                    "created_by": "some_user",
                    "id": 1,
                    "is_archived": False,
                    "name": "Test Project",
                    "status": "Proposed",
                },
                "is_archived": False,
            },
        )

    async def test_update_fail_on_start_date_update(self):
        self.assertResponse(
            await self.client.put(
                "/intentions/3",
                json={
                    "name": "Updated Intention",
                    "description": "Updated intention description",
                    "target_page_count": 15000,
                    "start_date": "2025-02-01",
                    "end_date": "2025-12-01",
                },
            ),
            400,
            {
                "detail": (
                    "The start date of this intention cannot be changed "
                    "because it is already linked to "
                    "one or more digitization lists."
                )
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/intentions/2"),
            200,
            {
                "id": 2,
                "name": "Test Intention 2",
                "description": "Test intention 2",
                "target_page_count": 30000,
                "start_date": None,
                "end_date": "2028-02-10T00:00:00",
                "project": None,
                "is_archived": False,
            },
        )

    async def test_delete_fail_on_linked_to_project(self):
        self.assertResponse(
            await self.client.delete("/intentions/1"),
            400,
            {
                "detail": (
                    "This intention cannot be deleted "
                    "because it is linked to a project."
                )
            },
        )

    async def test_delete_fail_on_linked_to_digitalization_list(self):
        self.assertResponse(
            await self.client.delete("/intentions/3"),
            400,
            {
                "detail": (
                    "This intention cannot be deleted "
                    "because it is used in one or more digitization lists."
                )
            },
        )
