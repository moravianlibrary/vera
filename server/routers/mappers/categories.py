from typing import List
from models import Extraction, Category
from schemas import CategoryResponse
from sqlalchemy.orm import Session


def map_to_category(
    db_session: Session, category: Category
) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        extract_whole=category.extract_whole,
        disabled=category.disabled,
        departments=category.departments,
        predecessors_departments=category.predecessors_departments,
        total_pages=category.total_pages(db_session),
        total_documents=category.total_documents,
        extractable_pages=category.extractable_pages(db_session),
        extractable_documents=category.extractable_documents(db_session),
        sub_categories=[],
    )


def map_to_category_with_sub_categories(
    db_session: Session, category: Category
) -> CategoryResponse:
    sub_categories: List[CategoryResponse] = [
        map_to_category_with_sub_categories(db_session, sub_category)
        for sub_category in category.sub_categories
    ]

    category_schema: CategoryResponse = map_to_category(db_session, category)
    category_schema.sub_categories = sub_categories

    return category_schema


def map_to_category_distribution(
    db_session: Session, category: Category, intention_id: int
) -> CategoryResponse:
    sub_categories: List[CategoryResponse] = [
        map_to_category_distribution(db_session, sub_category, intention_id)
        for sub_category in category.sub_categories
    ]

    category_schema: CategoryResponse = map_to_category(db_session, category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention(db_session)
        )

    return category_schema


def map_to_category_extraction(
    db_session: Session,
    category: Category,
    intention_id: int,
    extraction: Extraction,
) -> CategoryResponse:
    sub_categories: List[CategoryResponse] = [
        map_to_category_extraction(
            db_session, sub_category, intention_id, extraction
        )
        for sub_category in category.sub_categories
    ]

    extracted_pages, extracted_documents = category.generate_extraction_report(
        extraction.document_ids
    )
    extracted_pages += sum(
        sub_category.extracted_pages
        for sub_category in sub_categories
        if sub_category.extracted_pages
    )
    extracted_documents += sum(
        sub_category.extracted_documents
        for sub_category in sub_categories
        if sub_category.extracted_documents
    )

    category_schema: CategoryResponse = map_to_category(db_session, category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention(db_session)
        )

    category_schema.digitization_list_id = extraction.id
    category_schema.extracted_pages = extracted_pages
    category_schema.extracted_documents = extracted_documents

    return category_schema


def map_to_category_digitization(
    db_session: Session,
    category: Category,
    intention_id: int,
    digitization_ids: List[int],
) -> CategoryResponse:
    sub_categories: List[CategoryResponse] = [
        map_to_category_digitization(
            db_session, sub_category, intention_id, digitization_ids
        )
        for sub_category in category.sub_categories
    ]

    digitized_pages, digitized_documents = (
        category.generate_digitization_report(digitization_ids)
    )
    digitized_pages += sum(
        sub_category.digitized_pages
        for sub_category in sub_categories
        if sub_category.digitized_pages
    )
    digitized_documents += sum(
        sub_category.digitized_documents
        for sub_category in sub_categories
        if sub_category.digitized_documents
    )

    category_schema: CategoryResponse = map_to_category(db_session, category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention(db_session)
        )

    category_schema.digitization_ids = digitization_ids
    category_schema.digitized_pages = digitized_pages
    category_schema.digitized_documents = digitized_documents

    return category_schema
