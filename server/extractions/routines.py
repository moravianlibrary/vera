from sqlalchemy.orm import Session
from typing import List, Optional

from categories import crud
from categories.schemas import Category
from extractions.schemas import DocumentPagesCount, ExtractionCreateBase
# from extractions.crud import get_category_documents


def generate_extraction(props: ExtractionCreateBase,
                        target_pages: int,
                        db: Session):
    target_pages_threshold: float = max(props.target_pages_threshold, .0)
    whole_categories_threshold: float = max(props.whole_categories_threshold,
                                            .0)

    selected_documents = []

    def extract_from_category(category: Category,
                              target_pages: int):
        from extractions.crud import get_category_documents
        if category.extract_whole:
            pages_count = crud.get_pages_count(category.id, db)
            if (not props.include_whole_categories and
                    pages_count > target_pages * (1 +
                                                  whole_categories_threshold)):
                return 0
            documents = [document.id for document
                         in get_category_documents(category.id, db)]
        else:
            category_documents = get_category_documents(category.id, db)
            documents, pages_count = select_documents_within_threshold(
                category_documents, target_pages, target_pages_threshold
            )
        selected_documents.extend(documents)
        return pages_count

    def inorder_traversal(category: Optional[Category],
                          target_pages: int) -> int:
        if category is not None and category.assignable:
            return extract_from_category(category, target_pages)

        children = (crud.get_children_categories(category.id, db)
                    if category is not None
                    else crud.get_root_categories(db))

        selected_pages = 0
        missing_from_prev = 0
        for child in children:
            child_quota = int((child.percentage * target_pages) / 100)
            child_pages = inorder_traversal(
                child, child_quota + missing_from_prev
            )
            selected_pages += child_pages
            if props.balance_total_pages:
                missing_from_prev = child_quota - child_pages
            elif child_pages < child_quota:
                missing_from_prev = child_quota - child_pages

        return selected_pages

    return selected_documents, inorder_traversal(None, target_pages)


def select_documents_within_threshold(documents: List[DocumentPagesCount],
                                      target_pages: int,
                                      threshold: float,
                                      max_pages_order: int = 1000
                                      ) -> List[DocumentPagesCount]:
    selected_documents = []
    selected_pages_count = 0
    lower_limit = int(target_pages * (1 - threshold))
    upper_limit = int(target_pages * (1 + threshold))

    n = len(documents)
    # dp_y_size = min(target_pages, max_pages_order)
    dp_y_size = target_pages
    dp = [[0] * (dp_y_size + 1) for _ in range(n + 1)]
    selected_docs = [[False] * (dp_y_size + 1) for _ in range(n + 1)]

    def get_scaled_pages_count(index: int) -> int:
        return documents[i].pages_count

    for count in range(dp_y_size + 1):
        dp[n][count] = count

    for i in range(n - 1, -1, -1):
        for curr_sum in range(dp_y_size, -1, -1):
            next_sum = curr_sum + get_scaled_pages_count(i)
            pick = dp[i + 1][next_sum] if next_sum <= dp_y_size else 0
            leave = dp[i + 1][curr_sum]

            if pick >= leave:
                dp[i][curr_sum] = pick
                selected_docs[i][curr_sum] = True
            else:
                dp[i][curr_sum] = leave

    i = 0
    j = 0
    while i < n:
        if selected_docs[i][j]:
            selected_documents.append(documents[i].id)
            selected_pages_count += documents[i].pages_count
            j += documents[i].pages_count
        i += 1

    if (selected_pages_count < lower_limit
            or upper_limit < selected_pages_count):
        return [], 0

    return selected_documents, selected_pages_count

    # i = 0
    # while i < n:
    #     scaled_pages_count = get_scaled_pages_count(i)
    #     if (selected_pages_count + scaled_pages_count <= dp_y_size
    #             and dp[i][selected_pages_count] =
    # = dp[i + 1][selected_pages_count + scaled_pages_count]):
    #         selected_documents.append(documents[i].id)
    #         selected_pages_count += scaled_pages_count
    #     i += 1

    # return selected_documents, selected_pages_count

    # def backtrack(start_index, remaining_pages):
    #     if remaining_pages < lower_remaining
    #       or start_index >= len(documents):
    #         return False

    #     nonlocal selected_pages_count
    #     for i in range(start_index, len(documents)):
    #         selected_documents.append(documents[i].id)
    #         selected_pages_count += documents[i].pages_count
    #         next_remaining_pages = remaining_pages - documents[i].pages_count
    #         if lower_remaining <= next_remaining_pages <= upper_remaining:
    #             return True
    #         if backtrack(i + 1, next_remaining_pages):
    #             return True
    #         selected_documents.pop()
    #         selected_pages_count -= documents[i].pages_count

    #     return False

    # backtrack(0, target_pages)
    # return selected_documents, selected_pages_count
