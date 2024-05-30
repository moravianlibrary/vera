from typing import List
from categories.categories.models import (
    Category,
    Distribution,
)
from categories.categories import schemas
from extractions.generated.models import GeneratedExtraction


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
        total_pages=category.total_pages,
        total_documents=category.total_documents,
        documents_with_pages=category.documents_with_pages,
        documents_without_cnb=category.documents_without_cnb,
        extractable_pages=category.extractable_pages,
        extractable_documents=category.extractable_documents,
        sub_categories=[],
    )


def map_to_category_distribution(
    category: Category, distribution: Distribution
):
    sub_categories = []
    for sub_category in category.sub_categories:
        sub_distribution = sub_category.find_distribution(
            distribution.intention_id
        )
        if sub_distribution:
            sub_categories.append(
                map_to_category_distribution(sub_category, sub_distribution)
            )
        else:
            sub_categories.append(map_to_category(sub_category))

    category_schema = map_to_category(category)
    category_schema.sub_categories = sub_categories

    category_schema.intention_id = distribution.intention_id
    category_schema.percentage = distribution.percentage
    category_schema.overall_percentage = distribution.overall_percentage
    category_schema.pages_needed_to_meet_intention = (
        distribution.pages_needed_to_meet_intention
    )
    return category_schema


def map_to_category_extraction(
    category: Category,
    distribution: Distribution,
    extraction: GeneratedExtraction,
) -> schemas.Category:
    sub_categories: schemas.Categories = []
    for sub_category in category.sub_categories:
        sub_distribution = sub_category.find_distribution(
            distribution.intention_id
        )
        if sub_distribution:
            sub_categories.append(
                map_to_category_extraction(
                    sub_category, sub_distribution, extraction
                )
            )
        else:
            sub_categories.append(map_to_category(sub_category))

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
    distribution: Distribution,
    digitization_ids: List[int],
) -> schemas.Categories:
    sub_categories: schemas.Categories = []
    for sub_category in category.sub_categories:
        sub_distribution = sub_category.find_distribution(
            distribution.intention_id
        )
        if sub_distribution:
            sub_categories.append(
                map_to_category_digitization(
                    sub_category, sub_distribution, digitization_ids
                )
            )
        else:
            sub_categories.append(map_to_category(sub_category))

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
