from typing import List
from categories.categories.models import Category
from categories.categories import schemas
from models.extractions import GeneratedExtraction


def map_to_category(category: Category):
    return schemas.Category(
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
        total_pages=category.total_pages,
        total_documents=category.total_documents,
        documents_with_pages=category.documents_with_pages,
        documents_without_cnb=category.documents_without_cnb,
        extractable_pages=category.extractable_pages,
        extractable_documents=category.extractable_documents,
        sub_categories=[],
    )


def map_to_category_distribution(category: Category, intention_id: int):
    sub_categories: List[schemas.Category] = [
        map_to_category_distribution(sub_category, intention_id)
        for sub_category in category.sub_categories
    ]

    category_schema = map_to_category(category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention
        )

    return category_schema


def map_to_category_extraction(
    category: Category,
    intention_id: int,
    extraction: GeneratedExtraction,
) -> schemas.Category:
    sub_categories: List[schemas.Category] = [
        map_to_category_extraction(sub_category, intention_id, extraction)
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

    category_schema = map_to_category(category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention
        )

    category_schema.extraction_id = extraction.id
    category_schema.extracted_pages = extracted_pages
    category_schema.extracted_documents = extracted_documents

    return category_schema


def map_to_category_digitization(
    category: Category,
    intention_id: int,
    digitization_ids: List[int],
) -> schemas.Categories:
    sub_categories: List[schemas.Category] = [
        map_to_category_digitization(
            sub_category, intention_id, digitization_ids
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

    category_schema = map_to_category(category)
    category_schema.sub_categories = sub_categories

    distribution = category.find_distribution(intention_id)
    if distribution:
        category_schema.intention_id = distribution.intention_id
        category_schema.percentage = distribution.percentage
        category_schema.overall_percentage = distribution.overall_percentage
        category_schema.pages_needed_to_meet_intention = (
            distribution.pages_needed_to_meet_intention
        )

    category_schema.digitization_ids = digitization_ids
    category_schema.digitized_pages = digitized_pages
    category_schema.digitized_documents = digitized_documents

    return category_schema
