from typing import List

from repositories.models.addition import AdditionModel


class TaskAdditionService:
    def __init__(self, task_repository):
        self.task_repository = task_repository

    def process(self, additions: List[AdditionModel]):
        pass
