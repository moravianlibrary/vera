from sqlalchemy import or_, and_
from sqlalchemy.sql import text
from sqlalchemy.orm import Query
from typing import List, Optional, Union

from documents import models, schemas
from categories.models import Category
from documents.enums import (
    GroupOption,
    NumberOption,
    TextOption,
    TreeOption,
    SortOrder,
    DocumentField,
)


DOCUMENT_FIELDS_MAPPING = {
    DocumentField.Sysno: "sysno",
    DocumentField.Volume: "volume",
    DocumentField.Category: "category_id",
    DocumentField.Title: "title",
    DocumentField.PagesCount: "pages_count",
}


def filter_documents_query_base(
    query_base: Query, query: Optional[schemas.DocumentsQuery] = None
):
    if query:
        query_base = filter_by_query(query_base, query)
        if query.sort:
            query_base = sort_query(query_base, query.sort)
    else:
        query_base = query_base.filter(models.Document.extraction_id.is_(None))

    return query_base


def sort_query(query_base: Query, sort: schemas.QuerySort):
    curr_sort = sort
    while curr_sort:
        field_name = DOCUMENT_FIELDS_MAPPING.get(curr_sort.field)
        if curr_sort.order == SortOrder.Ascending:
            query_base = query_base.order_by(
                getattr(models.Document, field_name).asc()
            )
        else:
            query_base = query_base.order_by(
                getattr(models.Document, field_name).desc()
            )
        curr_sort = curr_sort.and_then
    return query_base


def filter_by_query(query_base: Query, query: schemas.DocumentsQuery):
    if query.username:
        query_base = query_base.filter(
            models.Document.creator == query.username
        )
    if query.id_list:
        return filter_by_id_list(query.id_list, query_base)

    if query.extracted is None or not query.extracted:
        query_base = query_base.filter(models.Document.extraction_id.is_(None))
    else:
        query_base = query_base.filter(
            models.Document.extraction_id.isnot(None)
        )
    if query.category_id:
        query_base = query_base.filter(
            models.Document.category_id == query.category_id
        )
    if query.search_phrase:
        return filter_by_search_phrase(query.search_phrase, query_base)
    if query.search_group:
        return filter_by_group(query.search_group, query_base)


def filter_by_id_list(id_list: List[int], query_base: Query):
    return query_base.filter(models.Document.id.in_(id_list))


def filter_by_search_phrase(search_phrase: str, query_base: Query):
    return query_base.filter(
        or_(
            models.Document.sysno.startswith(search_phrase),
            models.Document.barcode.startswith(search_phrase),
            models.Document.signature.startswith(search_phrase),
            models.Document.title.startswith(search_phrase),
            and_(
                Category.name.isnot(None),
                Category.name.startswith(search_phrase),
            ),
        )
    )


def filter_by_group(search_group: schemas.SearchGroup, query_base: Query):
    return query_base.filter(build_filter(search_group, text("")))


def build_filter(
    search_rule: Union[schemas.SearchGroup, schemas.SearchField],
    query_base: Query,
):
    if isinstance(search_rule, schemas.SearchGroup):
        return build_group_filter(search_rule, query_base)
    return build_field_filter(search_rule)


def build_group_filter(search_group: schemas.SearchGroup, query_base: Query):
    sub_filters = [
        build_filter(sub_rule, query_base)
        for sub_rule in search_group.sub_rules
    ]
    if search_group.option == GroupOption.MatchAll:
        return and_(*sub_filters)
    elif search_group.option == GroupOption.MatchAny:
        return or_(*sub_filters)


def build_field_filter(search_field: schemas.SearchField):
    field_name = DOCUMENT_FIELDS_MAPPING[search_field.field]
    field = getattr(models.Document, field_name)
    if search_field.option in TextOption:
        return build_text_filter(
            field, search_field.option, search_field.value
        )
    elif search_field.option in NumberOption:
        return build_number_filter(
            field, search_field.option, search_field.value
        )
    elif search_field.option in TreeOption:
        return build_tree_filter(
            field, search_field.option, search_field.value
        )
    return None


def build_text_filter(field, option, value):
    if option == TextOption.Equals:
        return field == value
    elif option == TextOption.StartsWith:
        return field.startswith(value)
    elif option == TextOption.EndsWith:
        return field.endswith(value)
    elif option == TextOption.Contains:
        return field.contains(value)
    elif option == TextOption.NotContains:
        return ~field.contains(value)
    elif option == TextOption.NotEquals:
        return field != value
    elif option == TextOption.IsNull:
        return field.is_(None)
    elif option == TextOption.IsNotNull:
        return field.isnot(None)


def build_number_filter(field, option, value):
    if option == NumberOption.EqualTo:
        return field == value
    elif option == NumberOption.NotEqualTo:
        return field != value
    elif option == NumberOption.LessThan:
        return field < value
    elif option == NumberOption.MoreThan:
        return field > value
    elif option == NumberOption.Between:
        return and_(field >= value[0], field <= value[1])
    elif option == NumberOption.IsNull:
        return field.is_(None)
    elif option == NumberOption.IsNotNull:
        return field.isnot(None)


def build_tree_filter(field, option, value):
    if option == TreeOption.IsIn:
        return field.in_(value)
    elif option == TreeOption.IsNotIn:
        return ~field.in_(value)
    elif option == TreeOption.IsNull:
        return field.is_(None)
    elif option == TreeOption.IsNotNull:
        return field.isnot(None)
