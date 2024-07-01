from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional, Tuple, Union
from schemas.types.query_types import (
    DocumentField,
    GroupOption,
    EnumOption,
    NumberOption,
    TextOption,
    TreeOption,
    RegexOption,
    SortOrder,
)


class SearchField(BaseModel):
    field: DocumentField
    option: Union[
        TextOption, NumberOption, EnumOption, TreeOption, RegexOption
    ]
    value: Optional[Union[str, int, Tuple[int, int], List[int]]] = None


class SearchGroup(BaseModel):
    option: GroupOption
    sub_rules: List[Union[SearchGroup, SearchField]]


class QuerySort(BaseModel):
    field: DocumentField
    order: SortOrder = SortOrder.Descending
    and_then: Optional[QuerySort] = None


class DocumentsQuery(BaseModel):
    id_list: Optional[List[int]] = None
    search_phrase: Optional[str] = None
    search_group: Optional[SearchGroup] = None
    department_id: Optional[int] = None
    extracted: Optional[bool] = None
    username: Optional[str] = None
    sort: Optional[QuerySort] = None
