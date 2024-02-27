import unittest
from helper_funcs import setUpEnv


class TestRolesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_task_by_id(self):
        from celery_worker import run_task

        task_id = 22
        run_task(task_id)
