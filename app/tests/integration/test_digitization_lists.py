from definitions.digitization_registry import DigitizationListState
from repositories.models.catalog_record import CatalogRecordModel
from repositories.models.category import CategoryModel
from repositories.models.digitization_list import DigitizationListModel
from repositories.models.document import DocumentIterationModel, DocumentModel
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
