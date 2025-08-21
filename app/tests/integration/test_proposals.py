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


class TestIntegrationProposals(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_search(self):
        pass

    async def test_ingest(self):
        pass

    async def test_reingest(self):
        pass

    async def test_approve(self):
        pass

    async def test_reject(self):
        pass

    async def test_archive(self):
        pass

    async def test_delete(self):
        pass
