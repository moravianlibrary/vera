from sqlalchemy.orm import Session
from typing import List

from categories import crud
from categories.schemas import Category
from documents.crud import get_documents_query_base
from documents.schemas import Document, DocumentsQuery
from extractions.schemas import ExtractionCategoryNode


def get_category_subtree(
    extraction_documents_ids: List[int],
    category: Category,
    db: Session,
):
    documents: List[Document] = get_documents_query_base(
        db,
        DocumentsQuery(ids=extraction_documents_ids, category_id=category.id),
    ).all()
    extracted_pages_count = 0
    for document in documents:
        extracted_pages_count += (
            document.pages_count
            or document.pages_count_manual
            or document.pages_count_predicted
        )

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
            get_category_subtree(extraction_documents_ids, child, db)
            for child in crud.get_children_categories(category.id, db)
        ],
        count_pages=crud.get_pages_count(category.id, db),
        count_pages_extractable=crud.get_extractable_pages_count(
            category.id, db
        ),
        count_documents=crud.get_documents_count(category.id, False, db),
        count_documents_with_pages=(
            crud.get_documents_count(category.id, True, db)
        ),
        count_documents_extractable=crud.get_extractable_documents_count(
            category.id, db
        ),
        count_documents_without_cnb=(
            crud.get_documents_without_cnb_count(category.id, db)
        ),
        extracted_pages_count=extracted_pages_count,
        extracted_documents_count=len(documents),
    )
