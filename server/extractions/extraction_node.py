from sqlalchemy.orm import Session
from queue import PriorityQueue
from typing import List


class ExtractionNode:
    def __init__(
        self,
        category_id: int,
        target_pages: float,
        children: List["ExtractionNode"] = [],
        assignable: bool = False,
    ):
        self.category_id = category_id
        self.target_pages = target_pages
        self.extracted_pages = 0
        self.assignable = assignable
        self.children_queue: PriorityQueue["ExtractionNode"] = PriorityQueue()
        for child in children:
            self.children_queue.put(child)

    @property
    def priority(self):
        return self.extracted_pages / self.target_pages

    def __lt__(self, other: "ExtractionNode"):
        return self.priority < other.priority

    def extract(self, db: Session) -> bool:
        if not self.assignable and self.children_queue.empty():
            return False
