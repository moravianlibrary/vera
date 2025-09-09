from vera_plugins.definitions.plugin_types import PluginType

from repositories.models.associations.group import category_group_association
from repositories.models.associations.user import (
    category_user_association,
    group_user_association,
)
from repositories.models.category import CategoryModel, DistributionModel
from repositories.models.group import GroupModel
from repositories.models.plugin import PluginInstanceModel, PluginModel
from repositories.models.task import TaskModel
from repositories.models.user import UserModel
from schemas.category import Category
from tests.integration.case import (
    AssociationSeed,
    EntitySeed,
    ReindexRequest,
    SequenceSyncRequest,
    TestIntegrationCase,
)

BASE_TEST_DATA_SEED = [
    EntitySeed(
        [
            UserModel(
                id=f"id-{i}",
                username=f"user{i}",
                email=f"user{i}@mzk.cz",
                settings=(
                    {
                        "theme": "dark",
                        "notifications": i % 2 == 0,
                        "locale": "en-US" if i % 3 == 0 else "cs-CZ",
                    }
                    if i % 3 != 1
                    else {}
                ),
            )
            for i in range(1, 11)
        ],
    ),
    EntitySeed(
        [
            GroupModel(
                id=i,
                name=f"Group {i}",
                description=f"Description for group {i}",
            )
            for i in range(1, 6)
        ],
    ),
    AssociationSeed(
        group_user_association,
        {
            1: ["id-1", "id-2", "id-5"],
            2: ["id-2", "id-4", "id-10"],
            3: ["id-2", "id-5", "id-6", "id-9"],
            5: ["id-8", "id-9", "id-10"],
        },
    ),
    EntitySeed(
        PluginModel(
            id=1,
            name="Test Plugin",
            type=PluginType.DocumentDiscovery,
            meta={},
            data=b"test data",
        ),
    ),
    EntitySeed(
        PluginInstanceModel(
            plugin_id=1, name="Test Plugin Instance", created_by="superuser"
        ),
    ),
    EntitySeed(
        [
            CategoryModel(
                id=1,
                name="Category Level 1 - A",
                description="Top level category A",
                level=1,
                assignable=False,
                extract_whole=False,
                parent_id=None,
            ),
            CategoryModel(
                id=2,
                name="Category Level 1 - B",
                description="Top level category B",
                level=1,
                assignable=False,
                extract_whole=False,
                parent_id=None,
            ),
        ],
        Category,
    ),
    EntitySeed(
        [
            CategoryModel(
                id=3,
                name="Category Level 2 - A1",
                description="Child of Category Level 1 - A",
                level=2,
                assignable=False,
                extract_whole=False,
                parent_id=1,
            ),
            CategoryModel(
                id=4,
                name="Category Level 2 - A2",
                description="Another child of Category Level 1 - A",
                level=2,
                assignable=True,
                extract_whole=False,
                parent_id=1,
            ),
            CategoryModel(
                id=5,
                name="Category Level 2 - B1",
                description="Child of Category Level 1 - B",
                level=2,
                assignable=False,
                extract_whole=True,
                parent_id=2,
            ),
        ],
        Category,
    ),
    EntitySeed(
        [
            CategoryModel(
                id=6,
                name="Category Level 3 - A1A",
                description="Child of Category Level 2 - A1",
                level=3,
                assignable=True,
                extract_whole=True,
                parent_id=3,
            ),
            CategoryModel(
                id=7,
                name="Category Level 3 - A1B",
                description="Another child of Category Level 2 - A1",
                level=3,
                assignable=True,
                extract_whole=False,
                parent_id=3,
            ),
            CategoryModel(
                id=8,
                name="Category Level 3 - B1A",
                description="Child of Category Level 2 - B1",
                level=3,
                assignable=True,
                extract_whole=False,
                parent_id=5,
                document_discovery_id=1,
            ),
        ],
        Category,
    ),
    AssociationSeed(category_group_association, {1: [1], 4: [2, 3], 6: [1]}),
    AssociationSeed(
        category_user_association,
        {3: [f"id-{i}" for i in range(1, 5)], 6: ["id-8"], 8: ["id-10"]},
    ),
    ReindexRequest(CategoryModel, Category, list(range(1, 9))),
    SequenceSyncRequest(CategoryModel.__table__, 9),
]
DISTRIBUTIONS_TEST_DATA = [
    EntitySeed(
        [
            DistributionModel(
                name=f"Distribution {i}",
                description=f"Description for Distribution {i}",
                is_active=(i == 2),
            )
            for i in range(1, 4)
        ]
    ),
    SequenceSyncRequest(DistributionModel.__table__, 4),
]


class TestIntegrationCategories(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(BASE_TEST_DATA_SEED)

    async def test_search(self):
        hits = [
            {
                "_id": "1",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 1 - A",
                    "description": "Top level category A",
                    "parent_id": None,
                    "level": 1,
                    "path": [{"id": 1, "name": "Category Level 1 - A"}],
                    "assignable": False,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [{"id": 1, "name": "Group 1"}],
                    "direct_users": [],
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [],
                    "watchlists": [],
                },
            },
            {
                "_id": "2",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 1 - B",
                    "description": "Top level category B",
                    "parent_id": None,
                    "level": 1,
                    "path": [{"id": 2, "name": "Category Level 1 - B"}],
                    "assignable": False,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [],
                    "direct_users": [],
                    "effective_groups": [],
                    "effective_users": [],
                    "watchlists": [],
                },
            },
            {
                "_id": "3",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 2 - A1",
                    "description": "Child of Category Level 1 - A",
                    "parent_id": 1,
                    "level": 2,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                    ],
                    "assignable": False,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [],
                    "direct_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "watchlists": [],
                },
            },
            {
                "_id": "4",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 2 - A2",
                    "description": "Another child of Category " "Level 1 - A",
                    "parent_id": 1,
                    "level": 2,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 4, "name": "Category Level 2 - A2"},
                    ],
                    "assignable": True,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [
                        {"id": 2, "name": "Group 2"},
                        {"id": 3, "name": "Group 3"},
                    ],
                    "direct_users": [],
                    "effective_groups": [
                        {"id": 2, "name": "Group 2"},
                        {"id": 3, "name": "Group 3"},
                        {"id": 1, "name": "Group 1"},
                    ],
                    "effective_users": [],
                    "watchlists": [],
                },
            },
            {
                "_id": "5",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 2 - B1",
                    "description": "Child of Category Level 1 - B",
                    "parent_id": 2,
                    "level": 2,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                    ],
                    "assignable": False,
                    "extract_whole": True,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [],
                    "direct_users": [],
                    "effective_groups": [],
                    "effective_users": [],
                    "watchlists": [],
                },
            },
            {
                "_id": "6",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 3 - A1A",
                    "description": "Child of Category Level 2 - A1",
                    "parent_id": 3,
                    "level": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {"id": 6, "name": "Category Level 3 - A1A"},
                    ],
                    "assignable": True,
                    "extract_whole": True,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [{"id": 1, "name": "Group 1"}],
                    "direct_users": [{"id": "id-8", "username": "user8"}],
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-8", "username": "user8"},
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "watchlists": [],
                },
            },
            {
                "_id": "7",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 3 - A1B",
                    "description": "Another child of Category Level 2 - A1",
                    "parent_id": 3,
                    "level": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {"id": 7, "name": "Category Level 3 - A1B"},
                    ],
                    "assignable": True,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": None,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [],
                    "direct_users": [],
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "watchlists": [],
                },
            },
            {
                "_id": "8",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "name": "Category Level 3 - B1A",
                    "description": "Child of Category Level 2 - B1",
                    "parent_id": 5,
                    "level": 3,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                        {"id": 8, "name": "Category Level 3 - B1A"},
                    ],
                    "assignable": True,
                    "extract_whole": False,
                    "disabled": False,
                    "archived": False,
                    "document_discovery_id": 1,
                    "document_discovery_schedule_id": None,
                    "proportions": [],
                    "count_total_documents": 0,
                    "count_total_pages": 0,
                    "count_extractable_documents": 0,
                    "count_extractable_pages": 0,
                    "count_extracted_documents": 0,
                    "count_extracted_pages": 0,
                    "direct_groups": [],
                    "direct_users": [{"id": "id-10", "username": "user10"}],
                    "effective_groups": [],
                    "effective_users": [{"id": "id-10", "username": "user10"}],
                    "watchlists": [],
                },
            },
        ]
        self.assertResponse(
            await self.client.post(
                "/categories/search",
                json={
                    "query": {"match_all": {}},
                    "sort": [
                        {"created_at": {"order": "asc"}},
                        {"name": {"order": "asc"}},
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
                    "total": {"value": 8, "relation": "eq"},
                    "max_score": None,
                    "hits": hits,
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
            },
        )

    async def test_create_root_category(self):
        self.assertResponse(
            await self.client.post(
                "/categories",
                json={
                    "name": "New Root Category",
                    "description": "Description of new root category",
                    "assignable": True,
                    "extract_whole": False,
                },
            ),
            201,
            {
                "id": 9,
                "name": "New Root Category",
                "description": "Description of new root category",
                "parent_id": None,
                "level": 1,
                "path": [{"id": 9, "name": "New Root Category"}],
                "assignable": True,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [],
                "direct_users": [],
                "effective_groups": [],
                "effective_users": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_create_child_category(self):
        self.assertResponse(
            await self.client.post(
                "/categories",
                params={
                    "parent_id": 1,
                },
                json={
                    "name": "New Child Category",
                    "description": "Description of new child category",
                    "assignable": True,
                    "extract_whole": False,
                },
            ),
            201,
            {
                "id": 9,
                "name": "New Child Category",
                "description": "Description of new child category",
                "parent_id": 1,
                "level": 2,
                "path": [
                    {"id": 1, "name": "Category Level 1 - A"},
                    {"id": 9, "name": "New Child Category"},
                ],
                "assignable": True,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_update(self):
        self.assertResponse(
            await self.client.put(
                "/categories/1",
                json={
                    "name": "Updated Category Level 1 - A",
                    "description": "Updated description",
                    "assignable": False,
                    "extract_whole": True,
                    "disabled": True,
                },
            ),
            200,
            {
                "id": 1,
                "name": "Updated Category Level 1 - A",
                "description": "Updated description",
                "parent_id": None,
                "level": 1,
                "path": [{"id": 1, "name": "Updated Category Level 1 - A"}],
                "assignable": False,
                "extract_whole": True,
                "disabled": True,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [{"id": 1, "name": "Group 1"}],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_assignment(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/1/assignment",
                json={
                    "add": {
                        "groups": [2, 3],
                        "users": ["id-5", "id-6"],
                    },
                    "remove": {
                        "groups": [1],
                        "users": ["id-1", "id-2"],
                    },
                },
            ),
            200,
            {
                "id": 1,
                "name": "Category Level 1 - A",
                "description": "Top level category A",
                "parent_id": None,
                "level": 1,
                "path": [{"id": 1, "name": "Category Level 1 - A"}],
                "assignable": False,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [
                    {"id": 2, "name": "Group 2"},
                    {"id": 3, "name": "Group 3"},
                ],
                "direct_users": [
                    {"id": "id-5", "username": "user5"},
                    {"id": "id-6", "username": "user6"},
                ],
                "effective_groups": [
                    {"id": 2, "name": "Group 2"},
                    {"id": 3, "name": "Group 3"},
                ],
                "effective_users": [
                    {"id": "id-5", "username": "user5"},
                    {"id": "id-6", "username": "user6"},
                ],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_parent_between_categories(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/3/parent",
                params={"from_parent_id": 1, "to_parent_id": 2},
            ),
            200,
            {
                "id": 3,
                "name": "Category Level 2 - A1",
                "description": "Child of Category Level 1 - A",
                "parent_id": 2,
                "level": 2,
                "path": [
                    {"id": 2, "name": "Category Level 1 - B"},
                    {"id": 3, "name": "Category Level 2 - A1"},
                ],
                "assignable": False,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [],
                "direct_users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-3", "username": "user3"},
                    {"id": "id-4", "username": "user4"},
                ],
                "effective_groups": [],
                "effective_users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-3", "username": "user3"},
                    {"id": "id-4", "username": "user4"},
                ],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_parent_to_root(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/3/parent",
                params={"from_parent_id": 1},
            ),
            200,
            {
                "id": 3,
                "name": "Category Level 2 - A1",
                "description": "Child of Category Level 1 - A",
                "parent_id": None,
                "level": 1,
                "path": [{"id": 3, "name": "Category Level 2 - A1"}],
                "assignable": False,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [],
                "direct_users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-3", "username": "user3"},
                    {"id": "id-4", "username": "user4"},
                ],
                "effective_groups": [],
                "effective_users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-3", "username": "user3"},
                    {"id": "id-4", "username": "user4"},
                ],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_parent_from_root(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/1/parent",
                params={"to_parent_id": 2},
            ),
            200,
            {
                "id": 1,
                "name": "Category Level 1 - A",
                "description": "Top level category A",
                "parent_id": 2,
                "level": 2,
                "path": [
                    {"id": 2, "name": "Category Level 1 - B"},
                    {"id": 1, "name": "Category Level 1 - A"},
                ],
                "assignable": False,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": None,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [{"id": 1, "name": "Group 1"}],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_parent_resulting_in_too_deep_tree(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/1/parent",
                params={"to_parent_id": 8},
            ),
            400,
            {
                "detail": "Category level 5 exceeds allowed limits "
                "while updating parent for category id 1."
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_document_discovery(self):
        self.assertResponse(
            await self.client.patch(
                "/categories/1/document-discovery",
                params={"plugin_instance_id": 1},
            ),
            200,
            {
                "id": 1,
                "name": "Category Level 1 - A",
                "description": "Top level category A",
                "parent_id": None,
                "level": 1,
                "path": [{"id": 1, "name": "Category Level 1 - A"}],
                "assignable": False,
                "extract_whole": False,
                "disabled": False,
                "archived": False,
                "document_discovery_id": 1,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [{"id": 1, "name": "Group 1"}],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_reindex(self):
        self.assertResponse(
            await self.client.post(
                "/categories/reindex",
                json={"query": {"match_all": {}}},
            ),
            200,
            {
                "id": 1,
                "task_type": "Category.Reindex",
                "task_scope": "Category",
                "unscoped_task_type": "Reindex",
                "name": "Reindex categories",
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
                "/categories/reindex",
                json={"query": {"match_all": {}}},
                params={
                    "schedule_name": "Reindex categories every midnight",
                    "cron_expression": "0 0 * * *",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Reindex categories every midnight",
                "cron_expression": "0 0 * * *",
                "task_type": "Category.Reindex",
                "query": {"query": {"match_all": {}}},
                "data": None,
                "task_scope": "Category",
                "unscoped_task_type": "Reindex",
            },
        )

    async def test_run_document_discovery(self):
        self.assertResponse(
            await self.client.post(
                "/categories/8/run-document-discovery",
            ),
            200,
            {
                "id": 1,
                "task_type": "Category.DocumentDiscovery",
                "task_scope": "Category",
                "unscoped_task_type": "DocumentDiscovery",
                "name": "Run document discovery",
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
                "query": None,
                "data": {"category_id": 8, "plugin_instance_id": 1},
            },
        )

    async def test_schedule_document_discovery(self):
        self.assertResponse(
            await self.client.post(
                "/categories/8/run-document-discovery",
                params={
                    "schedule_name": "Document Discovery for Category 8",
                    "cron_expression": "0 0 * * *",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Document Discovery for Category 8",
                "cron_expression": "0 0 * * *",
                "task_type": "Category.DocumentDiscovery",
                "query": None,
                "data": {"category_id": 8, "plugin_instance_id": 1},
                "task_scope": "Category",
                "unscoped_task_type": "DocumentDiscovery",
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/categories/8"),
            200,
            {
                "id": 8,
                "name": "Category Level 3 - B1A",
                "description": "Child of Category Level 2 - B1",
                "parent_id": 5,
                "level": 3,
                "path": [
                    {"id": 2, "name": "Category Level 1 - B"},
                    {"id": 5, "name": "Category Level 2 - B1"},
                    {"id": 8, "name": "Category Level 3 - B1A"},
                ],
                "assignable": True,
                "extract_whole": False,
                "disabled": False,
                "archived": True,
                "document_discovery_id": 1,
                "document_discovery_schedule_id": None,
                "proportions": [],
                "count_total_documents": 0,
                "count_total_pages": 0,
                "count_extractable_documents": 0,
                "count_extractable_pages": 0,
                "count_extracted_documents": 0,
                "count_extracted_pages": 0,
                "direct_groups": [],
                "direct_users": [{"id": "id-10", "username": "user10"}],
                "effective_groups": [],
                "effective_users": [{"id": "id-10", "username": "user10"}],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )


class TestIntegrationCategoryDistributionsEmpty(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(BASE_TEST_DATA_SEED)

    async def test_create_first(self):
        self.assertResponse(
            await self.client.post(
                "/categories/distributions",
                json={
                    "name": "First Distribution",
                    "description": "Description for First Distribution",
                },
            ),
            200,
            {
                "id": 1,
                "name": "First Distribution",
                "description": "Description for First Distribution",
                "is_active": True,
            },
        )


class TestIntegrationCategoryDistributions(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(
            BASE_TEST_DATA_SEED + DISTRIBUTIONS_TEST_DATA
        )

    async def test_paginate(self):
        self.assertResponse(
            await self.client.get("/categories/distributions"),
            200,
            {
                "items": [
                    {
                        "id": 1,
                        "name": "Distribution 1",
                        "description": "Description for Distribution 1",
                        "is_active": False,
                    },
                    {
                        "id": 2,
                        "name": "Distribution 2",
                        "description": "Description for Distribution 2",
                        "is_active": True,
                    },
                    {
                        "id": 3,
                        "name": "Distribution 3",
                        "description": "Description for Distribution 3",
                        "is_active": False,
                    },
                ],
                "num_found": 3,
            },
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/categories/distributions",
                json={
                    "name": "New Distribution",
                    "description": "Description for New Distribution",
                },
            ),
            200,
            {
                "id": 4,
                "name": "New Distribution",
                "description": "Description for New Distribution",
                "is_active": False,
            },
        )

    async def test_update_info(self):
        self.assertResponse(
            await self.client.put(
                "/categories/distributions/1/info",
                json={
                    "name": "Updated Distribution 1",
                    "description": "Updated Description for Distribution 1",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Updated Distribution 1",
                "description": "Updated Description for Distribution 1",
                "is_active": False,
            },
        )

    async def test_set_as_active(self):
        self.assertResponse(
            await self.client.put(
                "/categories/distributions/1/set-as-active",
            ),
            200,
            {
                "id": 1,
                "name": "Distribution 1",
                "description": "Description for Distribution 1",
                "is_active": True,
            },
        )

    async def test_update_proportions(self):
        self.assertResponse(
            await self.client.put(
                "/categories/distributions/1/proportions",
                json={
                    "root_proportions": [
                        {"category_id": 1, "proportion": "0.2"},
                        {"category_id": 2, "proportion": "0.8"},
                    ]
                },
            ),
            200,
            {
                "id": 1,
                "task_type": "Category.Reindex",
                "task_scope": "Category",
                "unscoped_task_type": "Reindex",
                "name": "Reindex categories after updating proportions",
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

    async def test_update_proportions_invalid_sum(self):
        self.assertResponse(
            await self.client.put(
                "/categories/distributions/1/proportions",
                json={
                    "root_proportions": [
                        {"category_id": 1, "proportion": "0.2"},
                        {"category_id": 2, "proportion": "0.7"},
                    ]
                },
            ),
            400,
            {
                "detail": (
                    "Invalid top-level proportions: "
                    "sum must be 0.0 or 1.0, got 0.9000"
                )
            },
        )

    async def test_update_proportions_invalid_parent(self):
        self.assertResponse(
            await self.client.put(
                "/categories/distributions/1/proportions",
                json={
                    "root_proportions": [
                        {"category_id": 1, "proportion": "0.2"},
                        {"category_id": 2, "proportion": "0.5"},
                        {"category_id": 3, "proportion": "0.3"},
                    ]
                },
            ),
            400,
            {
                "detail": (
                    "Category with ID 3 "
                    "is not a child of the root category."
                )
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/categories/distributions/1"),
            200,
            {
                "id": 1,
                "task_type": "Category.Reindex",
                "task_scope": "Category",
                "unscoped_task_type": "Reindex",
                "name": "Reindex categories after deleting distribution",
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

    async def test_delete_fail_on_active(self):
        self.assertResponse(
            await self.client.delete("/categories/distributions/2"),
            400,
            {"detail": "Cannot delete an active distribution."},
        )
