from unittest.mock import MagicMock

from adapters.identity_provider import IdentityProvider
from app import app
from repositories.models.associations.user import group_user_association
from repositories.models.group import GroupModel
from repositories.models.role import RoleModel
from repositories.models.user import UserModel
from tests.integration.case import (
    AssociationSeed,
    EntitySeed,
    TestIntegrationCase,
)
from vera_state import get_identity_provider

TEST_DATA_SEED = [
    EntitySeed([GroupModel(id=1, name="OVK")]),
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
    EntitySeed(
        [
            UserModel(
                id="superuser",
                username="superuser",
                email="superuser@mzk.cz",
                settings={"theme": "dark"},
            )
        ]
    ),
    AssociationSeed(group_user_association, {1: ["superuser"]}),
]


class TestIntegrationUsers(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA_SEED)

    async def test_get_me(self):
        self.assertResponse(
            await self.client.get("/users/me"),
            200,
            {
                "id": "superuser",
                "username": "superuser",
                "email": "superuser@mzk.cz",
                "roles": [],
                "groups": [],
                "general_permissions": [],
                "ownership_permissions": [],
            },
        )

    async def test_get_my_settings(self):
        self.assertResponse(
            await self.client.get("/users/me/settings"),
            200,
            {"theme": "dark"},
        )

    async def test_update_my_settings(self):
        self.assertResponse(
            await self.client.post(
                "/users/me/settings", json={"theme": "light"}
            ),
            200,
            {"theme": "light"},
        )
        self.assertEntityProperties(
            UserModel,
            "superuser",
            {"settings": {"theme": "light"}},
        )

    async def test_get_my_notifications(self):
        pass

    async def test_permissions_emulation(self):
        try:
            app.dependency_overrides[get_identity_provider] = (
                lambda: IdentityProvider(MagicMock())
            )

            self.assertResponse(
                await self.client.post(
                    "/users/me/emulate",
                    json={
                        "general_permissions": [
                            "ReadUsersAndGroups",
                        ],
                        "ownership_permissions": [
                            {
                                "permission": "ReadDocuments",
                                "scope": "Global",
                            }
                        ],
                    },
                ),
                200,
                {
                    "id": "superuser",
                    "username": "superuser",
                    "email": "superuser@mzk.cz",
                    "roles": [],
                    "groups": [],
                    "general_permissions": [
                        "ReadUsersAndGroups",
                        "EmulateAccess",
                    ],
                    "ownership_permissions": [
                        {
                            "permission": "ReadDocuments",
                            "scope": "Global",
                        }
                    ],
                },
            )
            self.assertResponse(
                await self.client.delete("/users/me/emulate"),
                200,
                {
                    "id": "superuser",
                    "username": "superuser",
                    "email": "superuser@mzk.cz",
                    "general_permissions": [],
                    "roles": [],
                    "groups": [],
                    "ownership_permissions": [],
                },
            )
        finally:
            app.dependency_overrides.pop(get_identity_provider, None)

    async def test_paginate(self):
        self.assertResponse(
            await self.client.get("/users"),
            200,
            {
                "items": [
                    {
                        "id": "superuser",
                        "username": "superuser",
                        "email": "superuser@mzk.cz",
                    }
                ],
                "num_found": 1,
            },
        )

    async def test_paginate_from_identity_provider(self):
        try:
            ip = IdentityProvider(MagicMock())
            ip.paginate_users = MagicMock(
                return_value={
                    "items": [
                        {
                            "id": "random_user",
                            "username": "random_user",
                            "email": "random_user@example.com",
                        }
                    ],
                    "num_found": 1,
                }
            )
            app.dependency_overrides[get_identity_provider] = lambda: ip

            self.assertResponse(
                await self.client.get(
                    "/users/from-identity-provider",
                    params={"page": 1, "page_size": 10, "filter": "random_u"},
                ),
                200,
                {
                    "items": [
                        {
                            "id": "random_user",
                            "username": "random_user",
                            "email": "random_user@example.com",
                        }
                    ],
                    "num_found": 1,
                },
            )
        finally:
            app.dependency_overrides.pop(get_identity_provider, None)
