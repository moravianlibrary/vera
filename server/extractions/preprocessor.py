from sqlalchemy.orm import Session
from typing import List, Tuple

from categories.crud import (
    get_children_categories,
    get_root_categories,
)
from categories.models import Category as CategoryModel
from extractions.crud import get_extractable_documents
from extractions.extraction_node import ExtractionNode, getExtractionRoot
from extractions.schemas import ExtractionCreate


class ExtractionPreprocessor:
    def __init__(self, settings: ExtractionCreate, db: Session):
        self.settings = settings
        self.db = db

    def generate_extraction_tree(self) -> ExtractionNode:
        root_categories = get_root_categories(self.db)
        children_nodes = [
            self.generate_extraction_tree_rec(
                root_category,
            )[0]
            for root_category in root_categories
        ]
        total_percentage = sum([child.percentage for child in children_nodes])
        for child in children_nodes:
            child.set_relative_ratio(child.percentage / total_percentage)
        return getExtractionRoot(children_nodes)

    def generate_extraction_tree_rec(
        self,
        category: CategoryModel,
    ) -> Tuple[ExtractionNode, int]:
        if category.percentage == 0:
            return (None, 0)

        if category.assignable:
            node = ExtractionNode(
                category,
                self.settings.include_categories
                and category.id in self.settings.include_categories,
                documents=get_extractable_documents(category.id, self.db),
            )
            return (node, node.total_pages)

        children_nodes: List[ExtractionNode] = []
        children_pages_count = 0
        for child in get_children_categories(category.id, self.db):
            node = self.generate_extraction_tree_rec(child)
            if node[0]:
                children_nodes.append(node[0])
                children_pages_count += node[1]

        if not children_nodes:
            return (None, 0)

        total_percentage = sum([child.percentage for child in children_nodes])
        for child in children_nodes:
            child.set_relative_ratio(child.percentage / total_percentage)

        return (
            ExtractionNode(
                category,
                self.settings.include_categories
                and category.id in self.settings.include_categories,
                children_nodes,
            ),
            children_pages_count,
        )
