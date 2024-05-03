from sqlalchemy.orm import Session
from typing import List, Tuple

from categories.crud import (
    get_children_categories,
    get_root_categories,
)
from categories.models import Category as CategoryModel
from extractions.generated.crud import (
    get_extractable_documents,
)
from extractions.locations.crud import get_location_pattern
from extractions.generated.extraction_node import (
    ExtractionNode,
    getExtractionRoot,
)
from extractions.generated.schemas import GenerateExtraction


class ExtractionPreprocessor:
    def __init__(self, settings: GenerateExtraction, db: Session):
        self.settings = settings
        self.db = db
        self.location_patterns = [
            get_location_pattern(location_id, self.db)
            for location_id in settings.location_ids
        ]

    def generate_extraction_tree(self) -> ExtractionNode:
        children_nodes: List[ExtractionNode] = []
        for root in get_root_categories(self.db):
            node, pages_count = self.generate_extraction_tree_rec(root)
            if node:
                children_nodes.append(node)
        total_percentage = sum([child.percentage for child in children_nodes])
        for child in children_nodes:
            child.set_relative_ratio(child.percentage / total_percentage)
        return getExtractionRoot(children_nodes)

    def generate_extraction_tree_rec(
        self,
        category: CategoryModel,
    ) -> Tuple[ExtractionNode, int]:
        if category.percentage == 0 or category.percentage is None:
            return (None, 0)

        if category.assignable:
            node = ExtractionNode(
                category,
                self.settings.include_categories
                and category.id in self.settings.include_categories,
                documents=get_extractable_documents(
                    category.id, self.location_patterns, self.db
                ),
            )
            return (
                (node, node.total_pages) if node.total_pages > 0 else (None, 0)
            )

        children_nodes: List[ExtractionNode] = []
        children_pages_count = 0
        for child in get_children_categories(category.id, self.db):
            node, pages_count = self.generate_extraction_tree_rec(child)
            if node:
                children_nodes.append(node)
                children_pages_count += pages_count

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
