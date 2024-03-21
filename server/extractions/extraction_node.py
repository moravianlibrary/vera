from queue import PriorityQueue
from typing import List

from categories.models import Category as CategoryModel
from documents.models import Document as DocumentModel
from extractions.extraction_document import ExtractionDocument


class ExtractionRoot:
    def __init__(
        self,
        children: List["ExtractionNode"] = [],
    ):
        self.relative_ratio = 1.0
        self.total_pages = 0
        self.extracted_pages = 0
        self.parent_node = None

        self.main_queue: PriorityQueue["ExtractionNode"] = PriorityQueue()

        for child in children:
            child.set_parent(self)
            self.main_queue.put(child)
            self.total_pages += child.total_pages

    def set_parent(self, parent_node: "ExtractionNode"):
        self.parent_node = parent_node

    def has_next(self) -> bool:
        return not self.main_queue.empty()

    def get_next(self) -> "ExtractionNode":
        return self.main_queue.get()

    def add_extracted_pages(self, pages_count: int):
        self.extracted_pages += pages_count

    def propagate_extracted_pages(self, extracted_pages: int):
        self.extracted_pages += extracted_pages
        if self.parent_node:
            self.parent_node.propagate_extracted_pages(extracted_pages)

    def get_relative_target_pages(self, overall_target_pages: int) -> int:
        return (
            self.parent_node.get_relative_target_pages(overall_target_pages)
            * self.relative_ratio
            if self.parent_node
            else overall_target_pages
        )

    def requeue(self, node: "ExtractionNode"):
        if node.is_fully_extracted():
            return
        if node.assignable:
            self.remaining_capacity_queue.put(node)
        else:
            self.main_queue.put(node)


class ExtractionNode(ExtractionRoot):
    def __init__(
        self,
        category: CategoryModel,
        include_category: bool,
        children: List["ExtractionNode"] = [],
        documents: List[DocumentModel] = [],
    ):
        super().__init__(children)
        self.category_id = category.id
        self.percentage = category.percentage
        self.assignable = category.assignable
        self.extract_whole = category.extract_whole
        self.include_category = include_category

        self._documents: List[ExtractionDocument] = [
            ExtractionDocument(document) for document in documents
        ]
        self.total_pages = sum(
            [document.pages_count for document in self._documents]
        )

        self.extracted_documents: List[ExtractionDocument] = []

    @property
    def priority(self):
        return self.total_pages / self.relative_ratio

    def __lt__(self, other: "ExtractionNode"):
        if self.include_category and not other.include_category:
            return True
        if not self.include_category and other.include_category:
            return False
        return (
            self.priority < other.priority
            or self.total_pages < other.total_pages
        )

    @property
    def documents(self) -> List[ExtractionDocument]:
        if not self.extracted_documents:
            return self._documents
        return [
            document
            for document in self._documents
            if document not in self.extracted_documents
        ]

    def set_relative_ratio(self, ratio: float):
        self.relative_ratio = ratio

    def is_fully_extracted(self) -> bool:
        return (
            self.assignable
            and self.extracted_pages == self.total_pages
            or not self.has_next()
        )

    def set_extracted(
        self, documents: List[ExtractionDocument], extracted_pages: int
    ) -> bool:
        self.extracted_documents.extend(documents)
        self.propagate_extracted_pages(extracted_pages)
