from unittest.mock import MagicMock
from .base import TestEndpointsBase
from models import Task, TaskDocument, TaskDataset, PeriodicTask
from datatypes import TaskType
import worker


class TestTasksEndpoints(TestEndpointsBase):
    def setUp(self):
        super().setUp()
        self.mockIndexer()

    def mockRunTask(self):
        worker.celery_worker.conf.update(CELERY_ALWAYS_EAGER=True)
        self.run_task_mock = MagicMock()
        self.run_task_mock.delay = MagicMock(return_value=None)
        worker.run_task = self.run_task_mock

    def test_create_task_without_query(self):
        # Arrange
        self.mockRunTask()
        task_type = TaskType.GenerateItemsPagesDataset

        # Act
        response = self.client.post(
            f"/tasks?task_type={task_type.value}", headers=self.headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["id"], 1)
        self.assertEqual(body["task_type"], task_type.value)
        self.assertEqual(body["owner"], "test_user")
        # TODO: make it work
        # self.run_task_mock.delay.assert_called_once()

    def test_create_task_with_query(self):
        # Arrange
        self.mockRunTask()
        self.mockIndexerGetDocumentIds([1])
        task_type = TaskType.GenerateItemsPagesDataset

        # Act
        response = self.client.post(
            f"/tasks?task_type={task_type.value}",
            json={"query_params": {}},
            headers=self.headers,
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["id"], 1)
        self.assertEqual(body["task_type"], task_type.value)
        self.assertEqual(body["owner"], "test_user")
        self.assertEqual(
            [td.document_id for td in TaskDocument.all(self.session)], [1]
        )
        # TODO: make it work
        # self.run_task_mock.delay.assert_called_once()

    def test_kill_task(self):
        pass  # TODO

    def test_get_task(self):
        # Arrange
        self.session.add(Task(task_type=TaskType.Reindex, owner="test_user"))
        self.session.flush()

        # Act
        response = self.client.get("/tasks/1", headers=self.headers)

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["id"], 1)
        self.assertEqual(body["task_type"], TaskType.Reindex.value)
        self.assertEqual(body["owner"], "test_user")

    def test_get_task_documents(self):
        # Arrange
        self.session.add(Task(task_type=TaskType.Reindex, owner="test_user"))
        self.session.flush()
        self.session.add(TaskDocument(task_id=1, document_id=1))
        self.session.add(TaskDocument(task_id=1, document_id=2))
        self.session.flush()

        # Act
        response = self.client.get("/tasks/1/documents", headers=self.headers)

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(len(body), 2)
        self.assertEqual(body[0]["document_id"], 1)
        self.assertEqual(body[1]["document_id"], 2)

    def test_get_task_dataset(self):
        # Arrange
        self.session.add(
            Task(
                task_type=TaskType.GenerateItemsPagesDataset, owner="test_user"
            )
        )
        self.session.flush()
        self.session.add(TaskDataset(task_id=1, data={"header": "value"}))
        self.session.flush()

        # Act
        response = self.client.get("/tasks/1/dataset", headers=self.headers)

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body, {"header": "value"})

    def test_get_tasks(self):
        # Arrange
        self.session.add_all(
            [
                Task(task_type=TaskType.Reindex, owner="test_user"),
                Task(
                    task_type=TaskType.GenerateItemsPagesDataset,
                    owner="test_user",
                ),
            ]
        )
        self.session.flush()

        # Act
        response = self.client.get("/tasks", headers=self.headers)

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["num_found"], 2)
        self.assertEqual(
            body["items"][0]["task_type"],
            TaskType.GenerateItemsPagesDataset.value,
        )
        self.assertEqual(body["items"][1]["task_type"], TaskType.Reindex.value)


class TestPeriodicTasksEndpoints(TestTasksEndpoints):
    def test_create_periodic_task(self):
        # Arrange
        task_params = {
            "task_type": TaskType.PredictPeriodicalPageCount.value,
            "minute": 10,
            "hour": 5,
            "day_of_week": 1,
            "day_of_month": 15,
        }
        self.mockIndexer()

        # Act
        response = self.client.post(
            "/tasks/periodic", params=task_params, headers=self.headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(
            body["task_type"], TaskType.PredictPeriodicalPageCount.value
        )
        self.assertEqual(body["minute"], 10)
        self.assertEqual(body["hour"], 5)
        self.assertEqual(body["day_of_week"], 1)
        self.assertEqual(body["day_of_month"], 15)
        self.assertIsNone(body["query_params"])

    def test_update_periodic_task_query(self):
        # Arrange
        periodic_task = PeriodicTask(task_type=TaskType.Reindex, minute=0)
        self.session.add(periodic_task)
        self.session.flush()

        new_query_params = {"query": "updated"}

        # Act
        response = self.client.put(
            f"/tasks/periodic/{periodic_task.id}/query",
            json=new_query_params,
            headers=self.json_headers,
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["query_params"], new_query_params)

    def test_update_periodic_task_schedule(self):
        # Arrange
        periodic_task = PeriodicTask(task_type=TaskType.Reindex, minute=0)
        self.session.add(periodic_task)
        self.session.flush()

        new_schedule = {
            "minute": 15,
            "hour": 10,
            "day_of_week": 2,
            "day_of_month": 20,
        }

        # Act
        response = self.client.put(
            f"/tasks/periodic/{periodic_task.id}/schedule",
            params=new_schedule,
            headers=self.headers,
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["minute"], 15)
        self.assertEqual(body["hour"], 10)
        self.assertEqual(body["day_of_week"], 2)
        self.assertEqual(body["day_of_month"], 20)

    def test_delete_periodic_task(self):
        # Arrange
        periodic_task = PeriodicTask(task_type=TaskType.Reindex, minute=0)
        self.session.add(periodic_task)
        self.session.flush()

        # Act
        response = self.client.delete(
            f"/tasks/periodic/{periodic_task.id}", headers=self.headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["id"], periodic_task.id)
        self.assertIsNone(PeriodicTask.find(self.session, periodic_task.id))

    def test_get_periodic_task(self):
        # Arrange
        periodic_task = PeriodicTask(
            task_type=TaskType.GenerateItemsPagesDataset, minute=0
        )
        self.session.add(periodic_task)
        self.session.flush()

        # Act
        response = self.client.get(
            f"/tasks/periodic/{periodic_task.id}", headers=self.headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["id"], periodic_task.id)
        self.assertEqual(
            body["task_type"], TaskType.GenerateItemsPagesDataset.value
        )

    def test_get_periodic_tasks(self):
        # Arrange
        self.session.add_all(
            [
                PeriodicTask(task_type=TaskType.Reindex, minute=0),
                PeriodicTask(
                    task_type=TaskType.GenerateItemsPagesDataset, minute=5
                ),
            ]
        )
        self.session.flush()

        # Act
        response = self.client.get(
            "/tasks/search/periodic", headers=self.headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["num_found"], 2)
        self.assertEqual(
            body["items"][0]["task_type"],
            TaskType.GenerateItemsPagesDataset.value,
        )
        self.assertEqual(body["items"][1]["task_type"], TaskType.Reindex.value)
