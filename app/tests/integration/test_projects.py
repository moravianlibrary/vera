from definitions.project import ProjectStatus
from repositories.models.associations.user import group_user_association
from repositories.models.category import CategoryModel
from repositories.models.group import GroupModel
from repositories.models.intention import IntentionModel
from repositories.models.project import ProjectModel
from repositories.models.user import UserModel
from repositories.models.watchlist import WatchlistModel
from schemas.intention import Intention
from schemas.project import Project
from tests.integration.case import (
    AssociationSeed,
    EntitySeed,
    SequenceSyncRequest,
    TestIntegrationCase,
)

TEST_DATA = [
    EntitySeed(
        [
            UserModel(
                id=f"id-{i}", username=f"user{i}", email=f"user{i}@mzk.cz"
            )
            for i in range(1, 6)
        ],
    ),
    EntitySeed(
        [
            GroupModel(
                id=i,
                name=f"Group {i}",
                description=f"Description for group {i}",
            )
            for i in range(1, 3)
        ],
    ),
    AssociationSeed(
        group_user_association,
        {1: ["id-1", "id-2", "id-5"], 2: ["id-2", "id-3", "id-4"]},
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
            ProjectModel(
                id=1,
                name="Project 1",
                description="Description for project 1",
                created_by="id-1",
                target_page_count=10000,
                status=ProjectStatus.Approved,
            ),
            ProjectModel(
                id=2,
                name="Project 2",
                description="Description for project 2",
                created_by="id-2",
                start_date="2023-01-01T00:00:00",
                end_date="2023-12-31T23:59:59",
                status=ProjectStatus.Proposed,
            ),
            ProjectModel(
                id=3,
                name="Project 3",
                description="Description for project 3",
                created_by="id-3",
                target_page_count=2000,
                end_date="2023-06-30T23:59:59",
                status=ProjectStatus.Rejected,
            ),
        ],
        Project,
    ),
    EntitySeed(
        IntentionModel(
            id=1,
            name="Intention for Project 1",
            description="Description for intention 1",
            target_page_count=10000,
            project_id=1,
        ),
        Intention,
    ),
    SequenceSyncRequest(ProjectModel.__table__, 4),
    SequenceSyncRequest(IntentionModel.__table__, 2),
]


class TestIntegrationProjects(TestIntegrationCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        await self.seed_test_data(TEST_DATA)

    async def test_search(self):
        self.assertResponse(
            await self.client.post(
                "/projects/search",
                json={
                    "query": {
                        "match_all": {},
                    },
                    "size": 2,
                    "from": 0,
                    "sort": [{"created_at": {"order": "asc"}}],
                },
            ),
            200,
            {
                "took": 16,
                "timed_out": False,
                "_shards": {
                    "total": 1,
                    "successful": 1,
                    "skipped": 0,
                    "failed": 0,
                },
                "hits": {
                    "total": {"value": 3, "relation": "eq"},
                    "max_score": None,
                    "hits": [
                        {
                            "_index": "projects",
                            "_id": "1",
                            "_score": None,
                            "_source": {
                                "name": "Project 1",
                                "description": "Description for project 1",
                                "target_page_count": 10000,
                                "created_by": "id-1",
                                "created_at": "2025-09-11T21:07:47.203150",
                                "priority": 3,
                                "status": "Approved",
                                "is_archived": False,
                                "groups": [],
                                "users": [],
                                "status_log": [],
                                "watchlists": [],
                            },
                        },
                        {
                            "_index": "projects",
                            "_id": "2",
                            "_score": None,
                            "_source": {
                                "name": "Project 2",
                                "description": "Description for project 2",
                                "start_date": "2023-01-01T00:00:00",
                                "end_date": "2023-12-31T23:59:59",
                                "created_by": "id-2",
                                "created_at": "2025-09-11T21:07:47.203150",
                                "priority": 3,
                                "status": "Proposed",
                                "is_archived": False,
                                "groups": [],
                                "users": [],
                                "status_log": [],
                                "watchlists": [],
                            },
                        },
                    ],
                },
                "aggregations": None,
            },
            exclude_paths={
                ("took",),
                ("hits", "hits", "_source", "created_at"),
            },
        )

    async def test_create(self):
        self.assertResponse(
            await self.client.post(
                "/projects",
                json={
                    "name": "Project 4",
                    "description": "Description for project 4",
                    "target_page_count": 5000,
                    "start_date": "2023-05-01T00:00:00",
                    "end_date": "2023-10-31T23:59:59",
                },
            ),
            200,
            {
                "id": 4,
                "name": "Project 4",
                "description": "Description for project 4",
                "target_page_count": 5000,
                "start_date": "2023-05-01T00:00:00",
                "end_date": "2023-10-31T23:59:59",
                "created_by": "superuser",
                "created_at": "2025-09-11T20:59:42.379634",
                "priority": 3,
                "status": "Proposed",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_update(self):
        self.assertResponse(
            await self.client.put(
                "/projects/2",
                json={
                    "name": "Updated Project 2",
                    "description": "Updated description for project 2",
                    "target_page_count": 15000,
                    "start_date": "2023-02-01T00:00:00",
                    "end_date": "2023-11-30T23:59:59",
                },
            ),
            200,
            {
                "id": 2,
                "name": "Updated Project 2",
                "description": "Updated description for project 2",
                "target_page_count": 15000,
                "start_date": "2023-02-01T00:00:00",
                "end_date": "2023-11-30T23:59:59",
                "created_by": "id-2",
                "created_at": "2025-09-11T20:59:42.379634",
                "priority": 3,
                "status": "Proposed",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_assignment(self):
        self.assertResponse(
            await self.client.patch(
                "/projects/3/assignment",
                json={
                    "add": {
                        "groups": [1],
                        "users": ["id-4", "id-5"],
                    }
                },
            ),
            200,
            {
                "id": 3,
                "name": "Project 3",
                "description": "Description for project 3",
                "target_page_count": 2000,
                "start_date": None,
                "end_date": "2023-06-30T23:59:59",
                "created_by": "id-3",
                "created_at": "2025-09-11T21:07:47.203150",
                "priority": 3,
                "status": "Rejected",
                "is_archived": False,
                "groups": [{"id": 1, "name": "Group 1"}],
                "users": [
                    {"id": "id-4", "username": "user4"},
                    {"id": "id-5", "username": "user5"},
                ],
                "status_log": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_propose_documents(self):
        self.assertResponse(
            await self.client.post(
                "/projects/2/propose-documents",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "justification": "Justification text",
                    }
                ],
                params={
                    "file_name": "new_batch.txt",
                },
            ),
            200,
            {
                "batch_id": 1,
                "task": {
                    "id": 1,
                    "task_type": "Proposal.Ingest",
                    "task_scope": "Proposal",
                    "unscoped_task_type": "Ingest",
                    "name": "Propose documents for project 2",
                    "task_schedule_id": None,
                    "created_by": "superuser",
                    "has_query": False,
                    "has_data": True,
                    "task_state": "Initializing",
                    "created_at": "2025-08-09T15:02:03.474003",
                    "started_at": None,
                    "finished_at": None,
                    "total_count": 0,
                    "processed_count": 0,
                    "error_count": 0,
                    "result": None,
                },
            },
            exclude_paths={("task", "created_at")},
        )

    async def test_add_documents(self):
        self.assertResponse(
            await self.client.post(
                "/projects/1/add-documents",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "category_id": 1,
                        "priority": 2,
                    }
                ],
                params={"batch_name": "New Batch"},
            ),
            200,
            {
                "batch_id": 1,
                "task": {
                    "id": 1,
                    "task_type": "Addition.Ingest",
                    "task_scope": "Addition",
                    "unscoped_task_type": "Ingest",
                    "name": "Add documents for project 1",
                    "task_schedule_id": None,
                    "created_by": "superuser",
                    "has_query": False,
                    "has_data": True,
                    "task_state": "Initializing",
                    "created_at": "2025-08-09T15:02:03.474003",
                    "started_at": None,
                    "finished_at": None,
                    "total_count": 0,
                    "processed_count": 0,
                    "error_count": 0,
                    "result": None,
                },
            },
            exclude_paths={("task", "created_at")},
        )

    async def test_add_documents_fails_on_unapproved_project(self):
        self.assertResponse(
            await self.client.post(
                "/projects/2/add-documents",
                json=[
                    {
                        "identifier_type": "ISXN",
                        "identifier_value": "978-3-16-148410-4",
                        "category_id": 1,
                        "priority": 2,
                    }
                ],
                params={"batch_name": "New Batch"},
            ),
            400,
            {
                "detail": (
                    "Documents can only be added "
                    "to projects that have been approved."
                ),
            },
        )

    async def test_delete(self):
        self.assertResponse(
            await self.client.delete("/projects/3"),
            200,
            {
                "id": 3,
                "name": "Project 3",
                "description": "Description for project 3",
                "target_page_count": 2000,
                "start_date": None,
                "end_date": "2023-06-30T23:59:59",
                "created_by": "id-3",
                "created_at": "2025-09-11T21:07:47.203150",
                "priority": 3,
                "status": "Rejected",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_change_priority(self):
        self.assertResponse(
            await self.client.patch(
                "/projects/1/priority",
                json={"priority": 5},
            ),
            200,
            {
                "id": 1,
                "name": "Project 1",
                "description": "Description for project 1",
                "target_page_count": 10000,
                "start_date": None,
                "end_date": None,
                "created_by": "id-1",
                "created_at": "2025-09-11T20:59:42.379634",
                "priority": 5,
                "status": "Approved",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [],
                "watchlists": [],
            },
            exclude_paths={("created_at",)},
        )

    async def test_approve(self):
        self.assertResponse(
            await self.client.patch(
                "/projects/2/approve",
                json={
                    "message": "Approving the project.",
                },
            ),
            200,
            {
                "id": 2,
                "name": "Project 2",
                "description": "Description for project 2",
                "target_page_count": None,
                "start_date": "2023-01-01T00:00:00",
                "end_date": "2023-12-31T23:59:59",
                "created_by": "id-2",
                "created_at": "2025-09-11T20:59:42.379634",
                "priority": 3,
                "status": "Approved",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [
                    {
                        "status": "Approved",
                        "message": "Approving the project.",
                        "updated_by": "superuser",
                        "updated_at": "2025-09-11T21:07:47.203150",
                    }
                ],
                "watchlists": [],
            },
            exclude_paths={("created_at",), ("status_log", "updated_at")},
        )

    async def test_reject(self):
        self.assertResponse(
            await self.client.patch(
                "/projects/2/reject",
                json={
                    "message": "Rejecting the project.",
                },
            ),
            200,
            {
                "id": 2,
                "name": "Project 2",
                "description": "Description for project 2",
                "target_page_count": None,
                "start_date": "2023-01-01T00:00:00",
                "end_date": "2023-12-31T23:59:59",
                "created_by": "id-2",
                "created_at": "2025-09-11T20:59:42.379634",
                "priority": 3,
                "status": "Rejected",
                "is_archived": False,
                "groups": [],
                "users": [],
                "status_log": [
                    {
                        "status": "Rejected",
                        "message": "Rejecting the project.",
                        "updated_by": "superuser",
                        "updated_at": "2025-09-11T21:07:47.203150",
                    }
                ],
                "watchlists": [],
            },
            exclude_paths={("created_at",), ("status_log", "updated_at")},
        )

    async def test_create_watchlist(self):
        self.assertResponse(
            await self.client.post(
                "/projects/watchlist",
                json={"query": {"match_all": {}}},
                params={"name": "Projects"},
            ),
            200,
            {
                "id": 1,
                "name": "Projects",
                "description": None,
                "query": {"query": {"match_all": {}}},
                "subscriptions": [],
                "target": "Projects",
            },
        )
        self.assertEntityProperties(
            WatchlistModel,
            1,
            {
                "name": "Projects",
                "description": None,
                "target": "Projects",
                "query": {"query": {"match_all": {}}},
            },
        )
