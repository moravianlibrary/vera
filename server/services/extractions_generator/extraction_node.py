from queue import PriorityQueue
from typing import List, Optional

from models import Category as CategoryModel, Document


def getExtractionRoot(children: List["ExtractionNode"]):
    return ExtractionNode(children=children)


class ExtractionNode:
    def __init__(
        self,
        category: Optional[CategoryModel] = None,
        percentage: float = 1.0,
        include_category: bool = False,
        children: List["ExtractionNode"] = [],
        documents: List[Document] = [],
    ):
        self.category_id = category.id if category else -1
        self.percentage = percentage
        self.assignable = category.assignable if category else False
        self.extract_whole = category.extract_whole if category else False
        self.level = category.level if category else -1
        self.include_category = include_category

        self.relative_ratio = 1.0
        self.parent_node = None
        self.children: List["ExtractionNode"] = children
        for child in self.children:
            child.set_parent(self)

        self._documents: List[Document] = sorted(
            documents, key=lambda d: d.extraction_priority, reverse=True
        )
        self.total_pages = sum(document.pages_count for document in documents)
        self.extracted_documents: List[Document] = []
        self.extracted_pages = 0
        self.fully_extracted_pages = 0

    @property
    def priority(self):
        return self.total_pages / self.relative_ratio

    @property
    def documents(self) -> List[Document]:
        if not self.extracted_documents:
            return self._documents
        return [
            document
            for document in self._documents
            if document not in self.extracted_documents
        ]

    def set_parent(self, parent_node: "ExtractionNode"):
        self.parent_node = parent_node

    def get_leafs(self) -> List["ExtractionNode"]:
        leafs: List["ExtractionNode"] = []
        for node in self.children:
            node.get_leafs_rec(leafs)
        if not leafs and self.assignable:
            return [self]
        return leafs

    def get_leafs_rec(self, leafs: List["ExtractionNode"]):
        if self.assignable and not self.is_fully_extracted():
            leafs.append(self)
            return
        for child in self.children:
            child.get_leafs_rec(leafs)

    def propagate_extracted_pages(self, extracted_pages: int):
        self.extracted_pages += extracted_pages
        if self.parent_node:
            self.parent_node.propagate_extracted_pages(extracted_pages)

    def propagate_fully_extracted_pages(self, fully_extracted_pages: int):
        if self.parent_node:
            self.parent_node.propagate_fully_extracted_pages(
                fully_extracted_pages
            )
        else:
            self.fully_extracted_pages += fully_extracted_pages

    def delete_fully_extracted(self, node: "ExtractionNode"):
        self.children.remove(node)
        if not self.children and self.parent_node:
            self.parent_node.delete_fully_extracted(self)
            return
        self.propagate_fully_extracted_pages(node.extracted_pages)
        remaining_ratio = sum(
            [child.relative_ratio for child in self.children]
        )
        for child in self.children:
            child.set_relative_ratio(child.relative_ratio / remaining_ratio)

    def get_relative_target_pages(self, overall_target_pages: int) -> int:
        return (
            self.parent_node.get_relative_target_pages(overall_target_pages)
            * self.relative_ratio
            if self.parent_node
            else overall_target_pages
        )

    def propagate_documents_up(self, level: int) -> Optional[List[Document]]:
        if self.level < level - 1:
            for child in self.children:
                child.propagate_documents_up(level)
            return []

        if self.level == level:
            return self.documents

        self._documents = []
        for child in self.children:
            self._documents.extend(child.propagate_documents_up(level))
        self.total_pages = sum(
            [document.pages_count for document in self._documents]
        )
        self.children = []
        self.assignable = True
        return []

    def __lt__(self, other: "ExtractionNode"):
        if self.include_category and not other.include_category:
            return True
        if not self.include_category and other.include_category:
            return False
        if self.extract_whole and not other.extract_whole:
            return True
        if not self.extract_whole and other.extract_whole:
            return False
        return (
            self.priority < other.priority
            or self.total_pages < other.total_pages
        )

    def set_relative_ratio(self, ratio: float):
        self.relative_ratio = ratio

    def is_fully_extracted(self) -> bool:
        return (
            self.extracted_pages == self.total_pages
            if self.assignable
            else not self.children
        )

    def set_extracted(
        self, documents: List[Document], extracted_pages: int
    ) -> bool:
        self.extracted_documents.extend(documents)
        if self.parent_node:
            self.propagate_extracted_pages(extracted_pages)
            if self.is_fully_extracted():
                self.parent_node.delete_fully_extracted(self)
        else:
            self.extracted_pages += extracted_pages

    def __repr__(self) -> str:
        new_queue: PriorityQueue["ExtractionNode"] = PriorityQueue()
        children_info = []
        for child in self.children:
            children_info.append(repr(child))
        children_info_str = "\n".join(children_info)
        self.main_queue = new_queue
        return (
            f"ExtractionNode {self.category_id}:\n"
            f"- relative_ratio={self.relative_ratio}\n"
            f"- total_pages={self.total_pages}\n"
            f"- extracted_pages={self.extracted_pages})\n"
            f"- queue:\n"
            f"{children_info_str}\n"
        )
