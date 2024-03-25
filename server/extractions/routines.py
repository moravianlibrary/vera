from sqlalchemy.orm import Session

from categories import crud
from categories.schemas import Category
from extractions.schemas import (
    ExtractionCategoryNode,
)

from extractions.crud import get_extraction_documents


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
        count_documents_without_cnb=(
            crud.get_documents_without_cnb_count(category.id, db)
        ),
        count_documents_with_pages=(
            crud.get_documents_count(category.id, True, db)
        ),
        count_documents=crud.get_documents_count(category.id, False, db),
        extracted_pages_count=extracted_pages_count,
        extracted_documents_count=len(documents),
    )
