from unittest import skip

from repositories.models.associations.group import category_group_association
from repositories.models.associations.user import (
    category_user_association,
    group_user_association,
)
from repositories.models.category import CategoryModel
from repositories.models.group import GroupModel
from repositories.models.user import UserModel
from schemas.category import Category
from tests.integration.case import (
    AssociationSeed,
    EntitySeed,
    ReindexRequest,
    SequenceSyncRequest,
    TestIntegrationCase,
)

TEST_DATA_SEED = [
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
        ]
    ),
    EntitySeed(
        [
            GroupModel(
                id=i,
                name=f"Group {i}",
                description=f"Description for group {i}",
            )
            for i in range(1, 6)
        ]
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
            ),
        ],
        Category,
    ),
    AssociationSeed(category_group_association, {1: [1], 4: [2, 3], 6: [1]}),
    AssociationSeed(
        category_user_association,
        {3: [f"id-{i}" for i in range(1, 5)], 6: ["id-8"], 8: ["id-10"]},
    ),
    ReindexRequest(CategoryModel, Category, [1, 3, 4, 6, 7, 8]),
    SequenceSyncRequest(CategoryModel.__table__, 9),
]


@skip
class TestIntegrationCategories(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_search_categories(self):
        hits = [
            {
                "_id": "1",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "direct_groups": [{"id": 1, "name": "Group 1"}],
                    "direct_users": [],
                    "description": "Top level category A",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [],
                    "level": 1,
                    "name": "Category Level 1 - A",
                    "parent_id": None,
                    "path": [{"id": 1, "name": "Category Level 1 - A"}],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "2",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "direct_groups": [],
                    "direct_users": [],
                    "description": "Top level category B",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "effective_groups": [],
                    "effective_users": [],
                    "level": 1,
                    "name": "Category Level 1 - B",
                    "parent_id": None,
                    "path": [{"id": 2, "name": "Category Level 1 - B"}],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "3",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "direct_groups": [],
                    "direct_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "description": "Child of Category Level 1 - A",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "level": 2,
                    "name": "Category Level 2 - A1",
                    "parent_id": 1,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "4",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "direct_groups": [
                        {"id": 2, "name": "Group 2"},
                        {"id": 3, "name": "Group 3"},
                    ],
                    "direct_users": [],
                    "description": "Another child of Category " "Level 1 - A",
                    "disabled": False,
                    "extract_whole": False,
                    "effective_groups": [
                        {"id": 2, "name": "Group 2"},
                        {"id": 3, "name": "Group 3"},
                        {"id": 1, "name": "Group 1"},
                    ],
                    "effective_users": [],
                    "level": 2,
                    "name": "Category Level 2 - A2",
                    "parent_id": 1,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 4, "name": "Category Level 2 - A2"},
                    ],
                    "proportions": [],
                    "document_discovery": None,
                    "statistics": None,
                },
            },
            {
                "_id": "5",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "direct_groups": [],
                    "direct_users": [],
                    "description": "Child of Category Level 1 - B",
                    "disabled": False,
                    "extract_whole": True,
                    "effective_groups": [],
                    "effective_users": [],
                    "level": 2,
                    "name": "Category Level 2 - B1",
                    "parent_id": 2,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                    ],
                    "proportions": [],
                    "document_discovery": None,
                    "statistics": None,
                },
            },
            {
                "_id": "6",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "direct_groups": [{"id": 1, "name": "Group 1"}],
                    "direct_users": [{"id": "id-8", "username": "user8"}],
                    "description": "Child of Category Level 2 - A1",
                    "disabled": False,
                    "extract_whole": True,
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-8", "username": "user8"},
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "level": 3,
                    "name": "Category Level 3 - A1A",
                    "parent_id": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {"id": 6, "name": "Category Level 3 - A1A"},
                    ],
                    "proportions": [],
                    "document_discovery": None,
                    "statistics": None,
                },
            },
            {
                "_id": "7",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "direct_groups": [],
                    "direct_users": [],
                    "description": "Another child of Category Level 2 - A1",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "effective_groups": [{"id": 1, "name": "Group 1"}],
                    "effective_users": [
                        {"id": "id-1", "username": "user1"},
                        {"id": "id-2", "username": "user2"},
                        {"id": "id-3", "username": "user3"},
                        {"id": "id-4", "username": "user4"},
                    ],
                    "level": 3,
                    "name": "Category Level 3 - A1B",
                    "parent_id": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {"id": 7, "name": "Category Level 3 - A1B"},
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "8",
                "_index": "categories",
                "_score": None,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "direct_groups": [],
                    "direct_users": [{"id": "id-10", "username": "user10"}],
                    "description": "Child of Category Level 2 - B1",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "effective_groups": [],
                    "effective_users": [{"id": "id-10", "username": "user10"}],
                    "level": 3,
                    "name": "Category Level 3 - B1A",
                    "parent_id": 5,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                        {"id": 8, "name": "Category Level 3 - B1A"},
                    ],
                    "proportions": [],
                    "statistics": None,
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
                "direct_groups": [],
                "direct_users": [],
                "effective_groups": [],
                "effective_users": [],
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
                "direct_groups": [],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
            },
            exclude_paths={("created_at",)},
        )

    async def test_update_category(self):
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
                "direct_groups": [{"id": 1, "name": "Group 1"}],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
                "direct_groups": [{"id": 1, "name": "Group 1"}],
                "direct_users": [],
                "effective_groups": [{"id": 1, "name": "Group 1"}],
                "effective_users": [],
                "proportions": [],
                "statistics": None,
                "document_discovery": None,
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
