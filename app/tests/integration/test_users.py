from unittest.mock import MagicMock

from adapters.identity_provider import IdentityProvider
from app import app
from repositories.models.associations.user import group_user_association
from repositories.models.group import GroupModel
from repositories.models.role import RoleModel
from repositories.models.task import TaskModel, TaskNotificationModel
from repositories.models.user import UserModel
from repositories.models.watchlist import (
    WatchlistModel,
    WatchlistNotificationModel,
    WatchlistSubscriptionModel,
)
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
            ),
            UserModel(
                id="otheruser",
                username="otheruser",
                email="otheruser@mzk.cz",
            ),
        ]
    ),
    EntitySeed(
        TaskModel(
            id=1,
            task_type="Addition.Ingest",
            name="Test Task",
            task_state="Failed",
            created_by="superuser",
        )
    ),
    EntitySeed(
        [
            TaskNotificationModel(
                id=1,
                user_id="superuser",
                task_id=1,
                previous_state="Initializing",
                new_state="Planned",
                read_at="2025-09-10T11:19:08.520834",
                push_sent=True,
            ),
            TaskNotificationModel(
                id=2,
                user_id="superuser",
                task_id=1,
                previous_state="Planned",
                new_state="Running",
                push_sent=True,
            ),
            TaskNotificationModel(
                id=3,
                user_id="superuser",
                task_id=1,
                previous_state="Running",
                new_state="Failed",
            ),
        ]
    ),
    EntitySeed(
        WatchlistModel(
            id=1,
            name="Test Watchlist",
            description="A watchlist for testing",
            target="Documents",
            query={"query": {"term": {"type": "book"}}},
        )
    ),
    EntitySeed(
        [
            WatchlistSubscriptionModel(
                id=1,
                watchlist_id=1,
                user_id="superuser",
            ),
            WatchlistSubscriptionModel(
                id=2,
                watchlist_id=1,
                user_id="otheruser",
            ),
        ]
    ),
    EntitySeed(
        [
            WatchlistNotificationModel(
                id=1,
                user_id="superuser",
                watchlist_subscription_id=1,
                event="Entered",
                count=5,
                read_at="2025-09-10T11:19:08.520834",
                push_sent=True,
            ),
            WatchlistNotificationModel(
                id=2,
                user_id="superuser",
                watchlist_subscription_id=1,
                event="Exited",
                count=3,
            ),
            WatchlistNotificationModel(
                id=3,
                user_id="otheruser",
                watchlist_subscription_id=2,
                event="Entered",
                count=2,
            ),
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

    async def test_get_notifications_summary(self):
        self.assertResponse(
            await self.client.get("/users/me/notifications/summary"),
            200,
            {
                "task_count": 2,
                "task_push": [
                    {
                        "id": 3,
                        "previous_state": "Running",
                        "new_state": "Failed",
                        "created_at": "2025-09-10T11:23:48.277587",
                        "read_at": None,
                        "task": {
                            "id": 1,
                            "task_type": "Addition.Ingest",
                            "name": "Test Task",
                            "created_at": "2025-09-10T11:23:48.270461",
                            "started_at": None,
                            "finished_at": None,
                            "result": None,
                        },
                    }
                ],
                "watchlist_count": 1,
                "watchlist_push": [
                    {
                        "id": 2,
                        "event": "Exited",
                        "count": 3,
                        "created_at": "2025-09-10T11:23:48.290877",
                        "read_at": None,
                        "sent_via_email_at": None,
                        "watchlist": {"id": 1, "name": "Test Watchlist"},
                    }
                ],
            },
            exclude_paths={
                ("task_push", "created_at"),
                ("task_push", "task", "created_at"),
                ("watchlist_push", "created_at"),
            },
        )
        self.assertEntityProperties(
            TaskNotificationModel, 3, {"push_sent": True}
        )
        self.assertEntityProperties(
            WatchlistNotificationModel, 2, {"push_sent": True}
        )

    async def test_paginate_task_notifications(self):
        self.assertResponse(
            await self.client.get("/users/me/notifications/task"),
            200,
            {
                "items": [
                    {
                        "id": 1,
                        "previous_state": "Initializing",
                        "new_state": "Planned",
                        "created_at": "2025-09-10T11:29:01.248225",
                        "read_at": "2025-09-10T11:19:08.520834",
                        "task": {
                            "id": 1,
                            "task_type": "Addition.Ingest",
                            "name": "Test Task",
                            "created_at": "2025-09-10T11:29:01.241704",
                            "started_at": None,
                            "finished_at": None,
                            "result": None,
                        },
                    },
                    {
                        "id": 2,
                        "previous_state": "Planned",
                        "new_state": "Running",
                        "created_at": "2025-09-10T11:29:01.248225",
                        "read_at": None,
                        "task": {
                            "id": 1,
                            "task_type": "Addition.Ingest",
                            "result": None,
                            "created_at": "2025-09-10T11:29:01.241704",
                            "started_at": None,
                            "finished_at": None,
                            "name": "Test Task",
                        },
                    },
                    {
                        "id": 3,
                        "previous_state": "Running",
                        "new_state": "Failed",
                        "created_at": "2025-09-10T11:29:01.248225",
                        "read_at": None,
                        "task": {
                            "id": 1,
                            "task_type": "Addition.Ingest",
                            "name": "Test Task",
                            "created_at": "2025-09-10T11:29:01.241704",
                            "started_at": None,
                            "finished_at": None,
                            "result": None,
                        },
                    },
                ],
                "num_found": 3,
            },
            exclude_paths={
                ("items", "created_at"),
                ("items", "task", "created_at"),
            },
        )

    async def test_paginate_watchlist_notifications(self):
        self.assertResponse(
            await self.client.get("/users/me/notifications/watchlist"),
            200,
            {
                "items": [
                    {
                        "id": 1,
                        "event": "Entered",
                        "count": 5,
                        "created_at": "2025-09-10T11:31:52.537019",
                        "read_at": "2025-09-10T11:19:08.520834",
                        "sent_via_email_at": None,
                        "watchlist": {"id": 1, "name": "Test Watchlist"},
                    },
                    {
                        "id": 2,
                        "event": "Exited",
                        "count": 3,
                        "created_at": "2025-09-10T11:31:52.537019",
                        "read_at": None,
                        "sent_via_email_at": None,
                        "watchlist": {"id": 1, "name": "Test Watchlist"},
                    },
                ],
                "num_found": 2,
            },
            exclude_paths={("items", "created_at")},
        )

    async def test_mark_task_notification_as_read(self):
        self.assertResponse(
            await self.client.get(
                "/users/me/notifications/task/2/mark-as-read"
            ),
            200,
            {
                "id": 2,
                "previous_state": "Planned",
                "new_state": "Running",
                "created_at": "2025-09-10T11:29:01.248225",
                "read_at": "2025-09-10T11:33:45.123456",
                "task": {
                    "id": 1,
                    "task_type": "Addition.Ingest",
                    "name": "Test Task",
                    "created_at": "2025-09-10T11:29:01.241704",
                    "started_at": None,
                    "finished_at": None,
                    "result": None,
                },
            },
            exclude_paths={
                ("created_at",),
                ("task", "created_at"),
                ("read_at",),
            },
        )
        self.assertEntityPropertiesPresent(
            TaskNotificationModel, 2, {"read_at"}
        )

    async def test_mark_watchlist_notification_as_read(self):
        self.assertResponse(
            await self.client.get(
                "/users/me/notifications/watchlist/2/mark-as-read"
            ),
            200,
            {
                "id": 2,
                "event": "Exited",
                "count": 3,
                "created_at": "2025-09-10T11:31:52.537019",
                "read_at": "2025-09-10T11:35:12.123456",
                "sent_via_email_at": None,
                "watchlist": {"id": 1, "name": "Test Watchlist"},
            },
            exclude_paths={("created_at",), ("read_at",)},
        )
        self.assertEntityPropertiesPresent(
            WatchlistNotificationModel, 2, {"read_at"}
        )

    async def test_fail_on_marking_other_user_notification_as_read(self):
        self.assertResponse(
            await self.client.get(
                "/users/me/notifications/watchlist/3/mark-as-read"
            ),
            403,
            {
                "detail": (
                    "Watchlist notification with ID 3 "
                    "does not belong to user superuser."
                )
            },
        )

    async def test_mark_all_task_notifications_as_read(self):
        self.assertResponse(
            await self.client.get(
                "/users/me/notifications/task/mark-all-as-read"
            ),
            200,
            {"count": 2},
        )
        self.assertEntityPropertiesPresent(
            TaskNotificationModel, 2, {"read_at"}
        )
        self.assertEntityPropertiesPresent(
            TaskNotificationModel, 3, {"read_at"}
        )

    async def test_mark_all_watchlist_notifications_as_read(self):
        self.assertResponse(
            await self.client.get(
                "/users/me/notifications/watchlist/mark-all-as-read"
            ),
            200,
            {"count": 1},
        )
        self.assertEntityPropertiesPresent(
            WatchlistNotificationModel, 2, {"read_at"}
        )

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
                        "id": "otheruser",
                        "username": "otheruser",
                        "email": "otheruser@mzk.cz",
                    },
                    {
                        "id": "superuser",
                        "username": "superuser",
                        "email": "superuser@mzk.cz",
                    },
                ],
                "num_found": 2,
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
