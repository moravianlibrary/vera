from sqlalchemy.orm import Session
from typing import List, Tuple

from categories.crud import (
    get_children_categories,
    get_root_categories,
    get_extractable_documents_count,
)
from categories.models import Category as CategoryModel
from extractions.extraction_node import ExtractionNode


def generate_extraction_tree(
    target_pages: float, db: Session
) -> ExtractionNode:
    return ExtractionNode(
        0,
        target_pages,
        [
            generate_extraction_tree_rec(root_category, target_pages, db)[0]
            for root_category in get_root_categories(db)
        ],
    )


# TODO: divide into smaller functions
# TODO: generate with params categories included, extract whole, etc
def generate_extraction_tree_rec(
    category: CategoryModel, parent_target_pages: float, db: Session
) -> Tuple[ExtractionNode, float, int]:
    category_target_pages = (category.percentage * parent_target_pages) / 100
    if category.assignable:
        if category.percentage == 0:
            return (None, 0)
        return (
            ExtractionNode(category.id, category_target_pages),
            get_extractable_documents_count(category.id, db),
        )

    children_nodes: List[ExtractionNode] = []
    children_documents_count = 0

    for child in get_children_categories(category.id, db):
        node, documents_count = generate_extraction_tree_rec(
            child, category_target_pages, db
        )
        if documents_count > 0:
            children_nodes.append(node)
            children_documents_count += documents_count

    if not children_nodes:
        return (None, 0)

    return (
        ExtractionNode(category.id, category_target_pages, children_nodes),
        children_documents_count,
    )
