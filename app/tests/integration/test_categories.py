from unittest import skip

from tests.integration.case import TestIntegrationCase
from tests.integration.data import (
    seed_test_categories,
    seed_test_groups,
    seed_test_users,
)


class TestIntegrationCategories(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.users = await seed_test_users(self.db_session)
        self.groups = await seed_test_groups(self.users, self.db_session)
        self.categories = await seed_test_categories(
            self.users, self.groups, self.db_session
        )

    @skip
    async def test_search_categories(self):
        hits = [
            {
                "_id": "1",
                "_index": "categories",
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Top level category A",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
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
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Top level category B",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
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
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Child of Category Level 1 - A",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
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
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Another child of Category " "Level 1 - A",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
                    "level": 2,
                    "name": "Category Level 2 - A2",
                    "parent_id": 1,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 4, "name": "Category Level 2 - A2"},
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "5",
                "_index": "categories",
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": False,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Child of Category Level 1 - B",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": True,
                    "indirect_groups": [],
                    "indirect_users": [],
                    "level": 2,
                    "name": "Category Level 2 - B1",
                    "parent_id": 2,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "6",
                "_index": "categories",
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Child of Category Level 2 - A1",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": True,
                    "indirect_groups": [],
                    "indirect_users": [],
                    "level": 3,
                    "name": "Category Level 3 - A1A",
                    "parent_id": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {
                            "id": 6,
                            "name": "Category Level 3 - A1A",
                        },
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "7",
                "_index": "categories",
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Another child of Category " "Level 2 - A1",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
                    "level": 3,
                    "name": "Category Level 3 - A1B",
                    "parent_id": 3,
                    "path": [
                        {"id": 1, "name": "Category Level 1 - A"},
                        {"id": 3, "name": "Category Level 2 - A1"},
                        {
                            "id": 7,
                            "name": "Category Level 3 - A1B",
                        },
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
            {
                "_id": "8",
                "_index": "categories",
                "_score": 1.0,
                "_source": {
                    "archived": False,
                    "assignable": True,
                    "assigned_groups": [],
                    "assigned_users": [],
                    "description": "Child of Category Level 2 - B1",
                    "disabled": False,
                    "document_discovery": None,
                    "extract_whole": False,
                    "indirect_groups": [],
                    "indirect_users": [],
                    "level": 3,
                    "name": "Category Level 3 - B1A",
                    "parent_id": 5,
                    "path": [
                        {"id": 2, "name": "Category Level 1 - B"},
                        {"id": 5, "name": "Category Level 2 - B1"},
                        {
                            "id": 8,
                            "name": "Category Level 3 - B1A",
                        },
                    ],
                    "proportions": [],
                    "statistics": None,
                },
            },
        ]
        self.assertResponse(
            await self.client.post(
                "/categories/search", json={"query": "test"}
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
                    "max_score": 1.0,
                    "hits": hits,
                },
                "aggregations": None,
            },
            exclude_keys={"took"},
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
                "id": "any int",
                "name": "New Root Category",
                "description": "Description of new root category",
                "assignable": True,
                "extract_whole": False,
                "disabled": False,
                "level": 1,
                "parent_id": None,
            },
            exclude_keys={"id"},
        )
