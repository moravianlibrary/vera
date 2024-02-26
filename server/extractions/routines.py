from sqlalchemy.orm import Session
from typing import Dict, List, Optional

from categories import crud
from categories.schemas import Category
from extractions.schemas import (
    DocumentPagesCount,
    ExtractionCreate,
    ExtractionCategoryNode,
)

# from extractions.crud import get_category_documents
from extractions.crud import get_extraction_documents


class CategoryNode:
    def __init__(
        self, category: Optional[Category], children: List["CategoryNode"]
    ):
        self.category = category
        self.parent_node = None
        self.children = children
        self.target_pages = 0
        self.pages_count: Optional[int] = 0
        self.difference = 0
        self.count_children_extracted = 0
        self.is_done = False

    def add_child(self, child_node):
        self.children.append(child_node)

    def populate_children(
        self, parent_node: Optional["CategoryNode"], target_pages: int
    ):
        self.parent_node = parent_node
        self.target_pages = target_pages
        if not self.children:
            return

        active_children_percentage = sum(
            [
                child.category.percentage
                for child in self.children
                if not child.is_done
            ]
        )
        children_target_pages = 0
        for i, child in enumerate(self.children):
            if i < len(self.children) - 1:
                child_target_pages = round(
                    (target_pages * child.category.percentage)
                    / active_children_percentage
                )
                children_target_pages += child_target_pages
            else:
                child_target_pages = self.target_pages - children_target_pages
            child.populate_children(self, child_target_pages)

    def add_child_pages_count(self, target_pages, pages_count):
        if self.is_done:
            raise Exception("All children categories were already extracted")
        self.difference += target_pages - pages_count
        self.pages_count += pages_count
        self.count_children_extracted += 1
        self.is_done = self.count_children_extracted == len(self.children)
        if self.is_done and self.parent_node is not None:
            self.parent_node.add_child_pages_count(
                self.target_pages, self.pages_count
            )

    def get_difference_for_child(self, child: "CategoryNode"):
        difference = self.difference
        if self.parent_node:
            difference += self.parent_node.get_difference_for_child(self)
        if difference == 0:
            return 0

        active_children_percentage = [
            child.category.percentage
            for child in self.children
            if not child.is_done
        ]
        if len(active_children_percentage) == 1:
            return difference

        return int(
            (difference * child.category.percentage)
            / sum(active_children_percentage)
        )

    def get_target_pages(self):
        if self.parent_node is None:
            return self.target_pages
        return self.target_pages + self.parent_node.get_difference_for_child(
            self
        )

    def __repr__(self):
        return (
            f"CategoryNode(category={self.category}, "
            f"target_pages={self.target_pages}, "
            f"pages_count={self.pages_count}, "
            f"difference={self.difference}, "
            f"count_children_extracted={self.count_children_extracted}, "
            f"is_done={self.is_done})"
        )


class CategoryLeaf(CategoryNode):
    def __init__(self, category: Category):
        super().__init__(category, [])
        self.selected_documents: List[int] = []
        self.pages_count = None

    def set_extraction(self, pages_count):
        if self.pages_count is not None:
            raise Exception("Node pages count can be set only once")
        self.pages_count = pages_count
        self.is_done = True
        if self.parent_node is not None:
            self.parent_node.add_child_pages_count(
                self.target_pages, pages_count
            )

    def get_fullfilment_ratio(self, db: Session):
        from extractions.crud import get_category_documents

        category_id = self.category.id
        pages_count = sum(
            [
                document.pages_count
                for document in get_category_documents(category_id, db)
            ]
        )
        target_pages = self.get_target_pages()
        return float(pages_count) / target_pages if target_pages else 0

    def __repr__(self):
        return (
            f"CategoryLeaf(category={self.category}, "
            f"target_pages={self.target_pages}, "
            f"pages_count={self.pages_count}, "
            f"difference={self.difference}, "
            f"count_children_extracted={self.count_children_extracted}, "
            f"is_done={self.is_done}"
        )


def bottom_up_generator(target_pages: int, db: Session) -> List[CategoryLeaf]:
    assignable_nodes: List[CategoryLeaf] = []
    clustered_nodes: Dict[int, List[CategoryNode]] = {}

    for category in crud.get_assignable_categories(db):
        if category.percentage == 0.0:
            continue
        parent_id = category.parent_id
        if parent_id not in clustered_nodes:
            clustered_nodes[parent_id if parent_id else 0] = []
        leaf = CategoryLeaf(category)
        clustered_nodes[parent_id if parent_id else 0].append(leaf)
        assignable_nodes.append(leaf)

    parent_ids = list(clustered_nodes.keys())
    category_nodes = {}
    for parent_id in parent_ids:
        bottom_up_generator_rec(parent_id, clustered_nodes, category_nodes, db)

    if not clustered_nodes:
        return []

    clustered_nodes[0][0].populate_children(None, target_pages)
    return assignable_nodes


def bottom_up_generator_rec(
    category_id: int,
    clustered_nodes: Dict[int, List[CategoryNode]],
    category_nodes: Dict[int, CategoryNode],
    db: Session,
):
    if category_id == 0 or category_id in category_nodes:
        return

    category = crud.get_category(category_id, db)
    children = clustered_nodes.get(category_id, [])
    node = CategoryNode(category, children)
    category_nodes[category_id] = node

    parent_id = category.parent_id or 0
    parent_node = category_nodes.get(parent_id)
    if parent_node:
        parent_node.add_child(node)
    else:
        parent_node = CategoryNode(None, [])
        parent_node.add_child(node)
        category_nodes[parent_id] = parent_node
        if parent_id in clustered_nodes:
            clustered_nodes[parent_id].append(parent_node)
        else:
            clustered_nodes[parent_id] = [parent_node]

    bottom_up_generator_rec(parent_id, category_nodes, category_nodes, db)


def generate_extraction(
    props: ExtractionCreate, target_pages: int, db: Session
):
    target_pages_threshold: float = max(props.target_pages_threshold, 0.0)
    whole_categories_threshold: float = max(
        props.whole_categories_threshold, 0.0
    )

    assignable_nodes = bottom_up_generator(target_pages, db)
    include_nodes: List[CategoryLeaf] = []
    extract_whole_nodes: List[CategoryLeaf] = []
    other_nodes: List[CategoryLeaf] = []

    for node in assignable_nodes:
        if (
            props.include_categories
            and node.category.id in props.include_categories
        ):
            include_nodes.append(node)
        elif node.category.extract_whole:
            extract_whole_nodes.append(node)
        else:
            other_nodes.append(node)

    selected_documents = []
    selected_pages_count = 0

    for node in include_nodes:
        document_ids, pages_count = select_whole_category(node, db)
        node.set_extraction(pages_count)
        selected_documents.extend(document_ids)
        selected_pages_count += pages_count

    for node in extract_whole_nodes:
        document_ids, pages_count = extract_whole_category(
            node, whole_categories_threshold, db
        )
        node.set_extraction(pages_count)
        selected_documents.extend(document_ids)
        selected_pages_count += pages_count

    other_nodes.sort(key=lambda node: node.get_fullfilment_ratio(db))
    for node in other_nodes:
        document_ids, pages_count = select_within_threshold(
            node, target_pages_threshold, 1000, db
        )
        node.set_extraction(pages_count)
        selected_documents.extend(document_ids)
        selected_pages_count += pages_count

    return selected_documents, selected_pages_count


def extract_whole_category(
    category_node: CategoryLeaf, whole_categories_threshold: float, db: Session
):
    document_ids, pages_count = select_whole_category(category_node, db)
    target_pages = category_node.get_target_pages()
    print(pages_count > target_pages * (1 + whole_categories_threshold))
    if pages_count > target_pages * (1 + whole_categories_threshold):
        return [], 0
    return document_ids, pages_count


def select_whole_category(category_node: CategoryLeaf, db: Session):
    from extractions.crud import get_category_documents

    category_id = category_node.category.id
    document_ids = [
        document.id for document in get_category_documents(category_id, db)
    ]
    pages_count = crud.get_pages_count(category_id, db)
    return document_ids, pages_count


def select_within_threshold(
    category_node: CategoryLeaf,
    threshold: float,
    max_pages_order: int,
    db: Session,
) -> List[DocumentPagesCount]:
    from extractions.crud import get_category_documents

    category_id = category_node.category.id
    documents = get_category_documents(category_id, db)
    target_pages = category_node.get_target_pages()

    selected_documents = []
    selected_pages_count = 0
    upper_limit = int(target_pages * (1 + threshold))

    n = len(documents)
    # dp_y_size = min(target_pages, max_pages_order)
    dp_y_size = target_pages
    dp = [[0] * (dp_y_size + 1) for _ in range(n + 1)]
    selected_docs = [[False] * (dp_y_size + 1) for _ in range(n + 1)]

    def get_scaled_pages_count(index: int) -> int:
        return documents[index].pages_count

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
            j += documents[i].pages_count
            if j > upper_limit:
                break
            selected_documents.append(documents[i].id)
            selected_pages_count += documents[i].pages_count
            if j > target_pages:
                break
        i += 1

    if upper_limit < selected_pages_count:
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


def get_category_subtree(extraction_id, category: Category, db: Session):
    documents = get_extraction_documents(extraction_id, db, category.id)
    extracted_pages_count = 0
    for document in documents:
        extracted_pages_count += document.pages_count

    return ExtractionCategoryNode(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        percentage=category.percentage,
        extract_whole=category.extract_whole,
        disabled=category.disabled,
        departments=[
            d[0] for d in crud.get_category_departments(category.id, db)
        ],
        children=[
            get_category_subtree(extraction_id, child, db)
            for child in crud.get_children_categories(category.id, db)
        ],
        count_pages=crud.get_pages_count(category.id, db),
        count_documents_with_pages=(
            crud.get_documents_count(category.id, True, db)
        ),
        count_documents=crud.get_documents_count(category.id, False, db),
        extracted_pages_count=extracted_pages_count,
        extracted_documents_count=len(documents),
    )
