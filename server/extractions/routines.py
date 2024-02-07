from sqlalchemy.orm import Session
from typing import List, Optional

from categories import crud, schemas
from extractions.schemas import DocumentPagesCount
from extractions.crud import get_category_documents


def inorder_traversal(category: Optional[schemas.Category],
                      target_pages: int,
                      db: Session):
    if category.assignable:
        documents = get_category_documents(category.id, db)
        select_documents_within_threshold(
            documents, target_pages, 0.05
        )
        return 0

    children = (crud.get_children_categories(category.id, db)
                if category is not None
                else crud.get_root_categories(db))

    sum_pages = 0
    missing_from_prev = 0
    for child in children:
        child_quota = (child.percentage * target_pages) / 100
        child_pages = inorder_traversal(
            child, child_quota + missing_from_prev, db
        )
        if child_pages < child_quota:
            missing_from_prev = child_quota - child_pages

    return sum_pages


def select_documents_within_threshold(documents: List[DocumentPagesCount],
                                      target_pages: int,
                                      threshold: float
                                      ) -> List[DocumentPagesCount]:
    selected_documents = []
    selected_pages_count = 0
    min_pages = int(target_pages * (1 - threshold))
    max_pages = int(target_pages * (1 + threshold))

    def backtrack(start_index, remaining_pages):
        if min_pages <= remaining_pages <= max_pages:
            return True

        if remaining_pages < min_pages or start_index >= len(documents):
            return False

        nonlocal selected_pages_count
        for i in range(start_index, len(documents)):
            selected_documents.append(documents[i])
            selected_pages_count += documents[i].pages_count
            if backtrack(i + 1, remaining_pages - documents[i].pages_count):
                return True
            document = selected_documents.pop()
            selected_pages_count -= document.pages_count

        return False

    backtrack(0, target_pages)
    return selected_documents, selected_pages_count


def generate_extraction(pages_count: int,
                        extract_whole_threshold: float,
                        db: Session):
    pass


def generate_pages_limit_mapping(category: schemas.Category,
                                 pages_count: int,
                                 db: Session):
    pages_limit = category.percentage * pages_count
    if pages_limit == 0:
        return [(category, 0, [])]

    children_mappings = [
        generate_pages_limit_mapping(child, pages_count, db)
        for child in crud.get_children_categories(category.id, db)
    ]
    return category, 0, children_mappings
