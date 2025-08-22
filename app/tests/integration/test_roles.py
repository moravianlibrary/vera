from repositories.models.role import RoleModel
from tests.integration.case import (
    EntitySeed,
    SequenceSyncRequest,
    TestIntegrationCase,
)

TEST_DATA_SEED = [
    EntitySeed(
        [
            RoleModel(
                id=1,
                name="Admin",
                description="Administrator role",
                _general_permissions=["ReadUsersAndGroups", "ManageAccess"],
                _ownership_permissions=[
                    {"permission": "ReadDocuments", "scope": "Global"},
                    {"permission": "ManageDocuments", "scope": "Global"},
                    {"permission": "ReadCategories", "scope": "Global"},
                ],
            ),
            RoleModel(
                id=2,
                name="Editor",
                description="Editor role",
                _general_permissions=["AddDocuments"],
                _ownership_permissions=[
                    {"permission": "ReadDocuments", "scope": "Group"},
                    {"permission": "ReadAdditions", "scope": "Group"},
                ],
            ),
        ],
    ),
    SequenceSyncRequest(RoleModel.__table__, 3),
]


class TestIntegrationRoles(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_paginate(self):
        self.assertResponse(
            await self.client.get("/roles"),
            200,
            {
                "items": [
                    {
                        "id": 1,
                        "name": "Admin",
                        "description": "Administrator role",
                        "general_permissions": [
                            "ReadUsersAndGroups",
                            "ManageAccess",
                        ],
                        "ownership_permissions": [
                            {"permission": "ReadDocuments", "scope": "Global"},
                            {
                                "permission": "ManageDocuments",
                                "scope": "Global",
                            },
                            {
                                "permission": "ReadCategories",
                                "scope": "Global",
                            },
                        ],
                    },
                    {
                        "id": 2,
                        "name": "Editor",
                        "description": "Editor role",
                        "general_permissions": ["AddDocuments"],
                        "ownership_permissions": [
                            {"permission": "ReadDocuments", "scope": "Group"},
                            {"permission": "ReadAdditions", "scope": "Group"},
                        ],
                    },
                ],
                "num_found": 2,
            },
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/roles",
                json={
                    "name": "New Role",
                    "description": "A new role for testing",
                    "general_permissions": [
                        "ReadUsersAndGroups",
                        "ManageAccess",
                    ],
                    "ownership_permissions": [
                        {"permission": "ManageDocuments", "scope": "Group"},
                        {"permission": "ReadCategories", "scope": "Group"},
                    ],
                },
            ),
            200,
            {
                "id": 3,
                "name": "New Role",
                "description": "A new role for testing",
                "general_permissions": ["ReadUsersAndGroups", "ManageAccess"],
                "ownership_permissions": [
                    {"permission": "ManageDocuments", "scope": "Group"},
                    {"permission": "ReadCategories", "scope": "Group"},
                ],
            },
        )

    async def test_update_admin_role(self):
        self.assertResponse(
            await self.client.put(
                "/roles/1",
                json={
                    "name": "Updated Admin Role",
                    "description": "Updated description for admin role",
                    "general_permissions": [],
                    "ownership_permissions": [],
                },
            ),
            403,
            {"detail": "The Admin role cannot be modified."},
        )

    async def test_update(self):
        self.assertResponse(
            await self.client.put(
                "/roles/2",
                json={
                    "name": "Updated Role 2",
                    "description": "Updated description for role 2",
                    "general_permissions": [
                        "ReadUsersAndGroups",
                        "ManageAccess",
                    ],
                    "ownership_permissions": [
                        {"permission": "ManageDocuments", "scope": "Group"},
                        {"permission": "ReadCategories", "scope": "Group"},
                        {"permission": "ReadDocuments", "scope": "Group"},
                    ],
                },
            ),
            200,
            {
                "id": 2,
                "name": "Updated Role 2",
                "description": "Updated description for role 2",
                "general_permissions": ["ReadUsersAndGroups", "ManageAccess"],
                "ownership_permissions": [
                    {"permission": "ManageDocuments", "scope": "Group"},
                    {"permission": "ReadCategories", "scope": "Group"},
                    {"permission": "ReadDocuments", "scope": "Group"},
                ],
            },
        )

    async def test_delete_admin_role(self):
        self.assertResponse(
            await self.client.delete("/roles/1"),
            403,
            {"detail": "The Admin role cannot be deleted."},
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/roles/2"),
            200,
            {
                "id": 2,
                "name": "Editor",
                "description": "Editor role",
                "general_permissions": [
                    "AddDocuments",
                ],
                "ownership_permissions": [
                    {"permission": "ReadDocuments", "scope": "Group"},
                    {"permission": "ReadAdditions", "scope": "Group"},
                ],
            },
        )
