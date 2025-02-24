from sqlalchemy.orm import Session
from typing import List, Tuple

from models import Category, Location, Document
from schemas import Distribution
from .extraction_node import (
    ExtractionNode,
    getExtractionRoot,
)
from schemas import GenerateExtraction


class ExtractionPreprocessor:
    def __init__(self, settings: GenerateExtraction, db: Session):
        self.settings = settings
        self.db = db
        self.location_patterns = [
            Location.get(self.db, location_id).pattern
            for location_id in settings.location_ids
        ]

    def generate_extraction_tree(self, intention_id: int) -> ExtractionNode:
        children_nodes: List[ExtractionNode] = []
        for root in Category.get_root_categories(self.db):
            node, pages_count = self.generate_extraction_tree_rec(
                root, intention_id
            )
            if node:
                children_nodes.append(node)
        total_percentage = sum([child.percentage for child in children_nodes])
        for child in children_nodes:
            child.set_relative_ratio(child.percentage / total_percentage)
        return getExtractionRoot(children_nodes)

    def generate_extraction_tree_rec(
        self,
        category: Category,
        intention_id: int,
    ) -> Tuple[ExtractionNode, int]:
        distribution: List[Distribution] = [
            d for d in category.distributions if d.intention_id == intention_id
        ]
        if len(distribution) != 1 or distribution[0].percentage == 0:
            return (None, 0)
        distribution: Distribution = distribution[0]

        if category.assignable:
            if (
                self.settings.include_categories
                and category.id not in self.settings.include_categories
            ):
                return (None, 0)

            node = ExtractionNode(
                category,
                distribution.percentage / 100,
                self.settings.include_categories
                and category.id in self.settings.include_categories,
                documents=Document.get_extractable_documents(
                    self.db,
                    category.id,
                    self.location_patterns,
                    self.settings.ignore_digitization_states,
                ),
            )
            return (
                (node, node.total_pages) if node.total_pages > 0 else (None, 0)
            )

        children_nodes: List[ExtractionNode] = []
        children_pages_count = 0
        for sub_category in category.sub_categories:
            node, pages_count = self.generate_extraction_tree_rec(
                sub_category, intention_id
            )
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
                distribution.percentage / 100,
                self.settings.include_categories
                and category.id in self.settings.include_categories,
                children_nodes,
            ),
            children_pages_count,
        )
