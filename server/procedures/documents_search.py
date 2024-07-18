from sqlalchemy import or_, and_
from sqlalchemy.sql import text
from sqlalchemy.orm import Query
from typing import List, Optional, Union

from models import Document, Category
import schemas.documents_query as schemas
from schemas.types.query_types import (
    EnumOption,
    GroupOption,
    NumberOption,
    TextOption,
    TreeOption,
    RegexOption,
    SortOrder,
    DocumentField,
)
from extractions.locations.crud import get_location_pattern


DOCUMENT_FIELDS_MAPPING = {
    DocumentField.Sysno: "sysno",
    DocumentField.MaterialType: "material_type",
    DocumentField.IssuanceType: "issuance_type",
    DocumentField.Volume: "volume",
    DocumentField.Bundle: "bundle",
    DocumentField.Year: "year",
    DocumentField.Category: "category_id",
    DocumentField.Title: "title",
    DocumentField.Barcode: "barcode",
    DocumentField.Signature: "signature",
    DocumentField.Cnb: "cnb",
    DocumentField.IsbnIssn: "isbn_issn",
    DocumentField.DigitizationState: "digitization_state",
    DocumentField.PagesCount: "pages_count",
    DocumentField.PagesCountCatalog: "pages_count_catalog",
    DocumentField.PagesCountManual: "pages_count_manual",
    DocumentField.PagesCountPredicted: "pages_count_predicted",
    DocumentField.Location: "signature",
    DocumentField.Publisher: "publisher",
    DocumentField.PublishingPlace: "publishing_place",
    DocumentField.PublishingYear: "publishing_year",
    DocumentField.Creator: "creator",
    DocumentField.Extractor: "extractor",
}


def is_query_empty(query: schemas.DocumentsQuery) -> bool:
    return query is None or (
        query.id_list is None
        and query.search_phrase is None
        and query.search_group is None
        and query.department_id is None
        and query.username is None
        and query.extracted is None
    )


def filter_documents_query_base(
    query_base: Query, query: Optional[schemas.DocumentsQuery], db
):
    if not is_query_empty(query):
        query_base = filter_by_query(query_base, query, db)
    else:
        query_base = query_base.filter(Document.extraction_id.is_(None))

    if query and query.sort:
        query_base = sort_query(query_base, query.sort)

    return query_base


def sort_query(query_base: Query, sort: schemas.QuerySort):
    curr_sort = sort
    while curr_sort:
        field_name = DOCUMENT_FIELDS_MAPPING.get(curr_sort.field)
        if curr_sort.order == SortOrder.Ascending:
            query_base = query_base.order_by(
                getattr(Document, field_name).asc()
            )
        else:
            query_base = query_base.order_by(
                getattr(Document, field_name).desc()
            )
        curr_sort = curr_sort.and_then
    return query_base


def filter_by_query(query_base: Query, query: schemas.DocumentsQuery, db):
    if query.username:
        query_base = query_base.filter(Document.creator == query.username)
    if query.id_list:
        return filter_by_id_list(query.id_list, query_base)

    print("query.extracted", query.extracted)
    if query.extracted is None or not query.extracted:
        query_base = query_base.filter(Document.extraction_id.is_(None))
    else:
        query_base = query_base.filter(Document.extraction_id.isnot(None))
    if query.search_phrase:
        return filter_by_search_phrase(query.search_phrase, query_base)
    if query.search_group:
        return filter_by_group(query.search_group, query_base, db)
    return query_base


def filter_by_id_list(id_list: List[int], query_base: Query):
    return query_base.filter(Document.id.in_(id_list))


def filter_by_search_phrase(search_phrase: str, query_base: Query):
    return query_base.outerjoin(Category).filter(
        or_(
            Document.sysno.startswith(search_phrase),
            Document.barcode.startswith(search_phrase),
            Document.signature.startswith(search_phrase),
            Document.title.startswith(search_phrase),
            and_(
                Document.category_id.isnot(None),
                Category.name.startswith(search_phrase),
            ),
        )
    )


def filter_by_group(search_group: schemas.SearchGroup, query_base: Query, db):
    return query_base.filter(build_filter(search_group, text(""), db))


def build_filter(
    search_rule: Union[schemas.SearchGroup, schemas.SearchField],
    query_base: Query,
    db,
):
    if isinstance(search_rule, schemas.SearchGroup):
        return build_group_filter(search_rule, query_base, db)
    return build_field_filter(search_rule, db)


def build_group_filter(
    search_group: schemas.SearchGroup, query_base: Query, db
):
    sub_filters = [
        build_filter(sub_rule, query_base, db)
        for sub_rule in search_group.sub_rules
    ]
    if search_group.option == GroupOption.MatchAll:
        return and_(*sub_filters)
    elif search_group.option == GroupOption.MatchAny:
        return or_(*sub_filters)


def build_field_filter(search_field: schemas.SearchField, db):
    field_name = DOCUMENT_FIELDS_MAPPING[search_field.field]
    field = getattr(Document, field_name)
    if search_field.option.value == "IsNull":
        return field.is_(None)
    elif search_field.option.value == "IsNotNull":
        return field.isnot(None)
    elif search_field.option in TextOption:
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
    elif search_field.option in EnumOption:
        return build_enum_filter(
            field, search_field.option, search_field.value
        )
    elif search_field.option in RegexOption:
        if search_field.field == DocumentField.Location:
            return build_location_filter(
                field, search_field.option, search_field.value, db
            )


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


def build_tree_filter(field, option, value):
    if option == TreeOption.IsIn:
        return field.in_(value)
    elif option == TreeOption.IsNotIn:
        return ~field.in_(value)


def build_enum_filter(field, option, value):
    if option == EnumOption.Is:
        return field == value
    elif option == EnumOption.IsNot:
        return field != value


def build_location_filter(field, option, value, db):
    if value is None or len(value) == 0:
        return None

    filters = []

    for location_id in value:
        location_pattern = get_location_pattern(location_id, db)
        if option == RegexOption.Match:
            filters.append(field.op("~")(location_pattern))
        elif option == RegexOption.NotMatch:
            filters.append(~field.op("~")(location_pattern))

    if option == RegexOption.Match:
        return or_(*filters)
    elif option == RegexOption.NotMatch:
        return and_(*filters)
