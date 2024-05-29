from typing import List
from categories.categories.models import (
    Category,
    Distribution,
)
from categories.categories import schemas
from extractions.generated.models import GeneratedExtraction


def map_to_category_distribution(
    category: Category, distribution: Distribution, intention_id: int
):
    sub_categories = []
    for sub_category in category.sub_categories:
        sub_distribution = [
            distribution
            for distribution in sub_category.distributions
            if distribution.intention_id == intention_id
        ]
        if len(sub_distribution) == 1:
            sub_categories.append(
                map_to_category_distribution(
                    sub_category, sub_distribution[0], intention_id
                )
            )
    return schemas.CategoryDistribution(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        extract_whole=category.extract_whole,
        disabled=category.disabled,
        departments=category.departments,
        sub_categories=sub_categories,
        total_pages=category.total_pages,
        total_documents=category.total_documents,
        documents_with_pages=category.documents_with_pages,
        documents_without_cnb=category.documents_without_cnb,
        extractable_pages=category.extractable_pages,
        extractable_documents=category.extractable_documents,
        intention_id=distribution.intention_id,
        percentage=distribution.percentage,
        pages_needed_to_meet_intention=(
            distribution.pages_needed_to_meet_intention
        ),
    )


def map_to_category_extraction(
    category: Category,
    distribution: Distribution,
    extraction: GeneratedExtraction,
    intention_id: int,
) -> schemas.CategoryExtraction:
    sub_categories: List[schemas.CategoryExtraction] = []
    for sub_category in category.sub_categories:
        sub_distribution = [
            distribution
            for distribution in sub_category.distributions
            if distribution.intention_id == intention_id
        ]
        if len(sub_distribution) == 1:
            sub_categories.append(
                map_to_category_extraction(
                    sub_category, sub_distribution[0], extraction, intention_id
                )
            )

    extracted_pages, extracted_documents = category.generate_extraction_report(
        extraction.document_ids
    )
    extracted_pages += sum(
        sub_category.extracted_pages for sub_category in sub_categories
    )
    extracted_documents += sum(
        sub_category.extracted_documents for sub_category in sub_categories
    )

    return schemas.CategoryExtraction(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        extract_whole=category.extract_whole,
        disabled=category.disabled,
        departments=category.departments,
        sub_categories=sub_categories,
        total_pages=category.total_pages,
        total_documents=category.total_documents,
        documents_with_pages=category.documents_with_pages,
        documents_without_cnb=category.documents_without_cnb,
        extractable_pages=category.extractable_pages,
        extractable_documents=category.extractable_documents,
        intention_id=distribution.intention_id,
        percentage=distribution.percentage,
        pages_needed_to_meet_intention=(
            distribution.pages_needed_to_meet_intention
        ),
        extraction_id=extraction.id,
        extracted_pages=extracted_pages,
        extracted_documents=extracted_documents,
    )


def map_to_category_digitization(
    category: Category,
    distribution: Distribution,
    intention_id: int,
    digitization_ids: List[int],
) -> schemas.CategoryDigitization:
    sub_categories: List[schemas.CategoryDigitization] = []
    for sub_category in category.sub_categories:
        sub_distribution = [
            distribution
            for distribution in sub_category.distributions
            if distribution.intention_id == intention_id
        ]
        if len(sub_distribution) == 1:
            sub_categories.append(
                map_to_category_digitization(
                    sub_category,
                    sub_distribution[0],
                    intention_id,
                    digitization_ids,
                )
            )

    digitized_pages, digitized_documents = (
        category.generate_digitization_report(digitization_ids)
    )
    digitized_pages += sum(
        sub_category.digitized_pages for sub_category in sub_categories
    )
    digitized_documents += sum(
        sub_category.digitized_documents for sub_category in sub_categories
    )

    return schemas.CategoryDigitization(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        extract_whole=category.extract_whole,
        disabled=category.disabled,
        departments=category.departments,
        sub_categories=sub_categories,
        total_pages=category.total_pages,
        total_documents=category.total_documents,
        documents_with_pages=category.documents_with_pages,
        documents_without_cnb=category.documents_without_cnb,
        extractable_pages=category.extractable_pages,
        extractable_documents=category.extractable_documents,
        intention_id=distribution.intention_id,
        percentage=distribution.percentage,
        pages_needed_to_meet_intention=(
            distribution.pages_needed_to_meet_intention
        ),
        digitization_ids=digitization_ids,
        digitized_pages=digitized_pages,
        digitized_documents=digitized_documents,
    )
