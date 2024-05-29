from typing import List
from categories.categories.models import (
    Category,
    Distribution,
)
from categories.categories import schemas


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
    intention_id: int,
    extraction_documents: List[int],
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
