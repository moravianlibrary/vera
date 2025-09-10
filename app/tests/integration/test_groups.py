from repositories.models.associations.user import group_user_association
from repositories.models.group import GroupModel
from repositories.models.user import UserModel
from tests.integration.case import (
    AssociationSeed,
    EntitySeed,
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
    SequenceSyncRequest(GroupModel.__table__, 6),
]


class TestIntegrationGroups(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_paginate(self):
        self.assertResponse(
            await self.client.get("/groups"),
            200,
            {
                "items": [
                    {
                        "id": 1,
                        "name": "Group 1",
                        "description": "Description for group 1",
                        "users": [
                            {"id": "id-1", "username": "user1"},
                            {"id": "id-2", "username": "user2"},
                            {"id": "id-5", "username": "user5"},
                        ],
                    },
                    {
                        "id": 2,
                        "name": "Group 2",
                        "description": "Description for group 2",
                        "users": [
                            {"id": "id-10", "username": "user10"},
                            {"id": "id-2", "username": "user2"},
                            {"id": "id-4", "username": "user4"},
                        ],
                    },
                    {
                        "id": 3,
                        "name": "Group 3",
                        "description": "Description for group 3",
                        "users": [
                            {"id": "id-2", "username": "user2"},
                            {"id": "id-5", "username": "user5"},
                            {"id": "id-6", "username": "user6"},
                            {"id": "id-9", "username": "user9"},
                        ],
                    },
                    {
                        "id": 4,
                        "name": "Group 4",
                        "description": "Description for group 4",
                        "users": [],
                    },
                    {
                        "id": 5,
                        "name": "Group 5",
                        "description": "Description for group 5",
                        "users": [
                            {"id": "id-10", "username": "user10"},
                            {"id": "id-8", "username": "user8"},
                            {"id": "id-9", "username": "user9"},
                        ],
                    },
                ],
                "num_found": 5,
            },
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/groups",
                json={
                    "name": "New Group",
                    "description": "A new group for testing",
                },
            ),
            200,
            {
                "id": 6,
                "name": "New Group",
                "description": "A new group for testing",
                "users": [],
            },
        )

    async def test_update(self):
        self.assertResponse(
            await self.client.put(
                "/groups/1",
                json={
                    "name": "Updated Group 1",
                    "description": "Updated description for group 1",
                },
            ),
            200,
            {
                "id": 1,
                "name": "Updated Group 1",
                "description": "Updated description for group 1",
                "users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-5", "username": "user5"},
                ],
            },
        )

    async def test_change_assignment(self):
        self.assertResponse(
            await self.client.patch(
                "/groups/1/assignment",
                json={
                    "add": ["id-2", "id-4", "id-7", "id-9"],
                    "remove": ["id-3", "id-4", "id-5"],
                },
            ),
            200,
            {
                "description": "Description for group 1",
                "id": 1,
                "name": "Group 1",
                "users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-7", "username": "user7"},
                    {"id": "id-9", "username": "user9"},
                ],
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/groups/1"),
            200,
            {
                "id": 1,
                "name": "Group 1",
                "description": "Description for group 1",
                "users": [
                    {"id": "id-1", "username": "user1"},
                    {"id": "id-2", "username": "user2"},
                    {"id": "id-5", "username": "user5"},
                ],
            },
        )
