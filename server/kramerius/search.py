from enum import Enum
from typing import List, Optional, Tuple, Union

from kramerius.client import KrameriusApi
from kramerius.document import KrameriusDocument
from kramerius.types import SolrConjuction, SolrField


START_CURSOR_MARK = "*"
PAGINATE_PAGE_SIZE = 100
# PAGINATE_PAGE_SIZE = 1000

SolrValue = Union[str, int, float, List, Tuple, Enum]


class KrameriusSearch:
    def __init__(self, api: KrameriusApi):
        self.api = api

    def get_document(self, pid):
        params = (
            SearchParams()
            .with_rows(1)
            .with_query(SearchQuery(SolrField.Pid, pid).build())
        )
        response = self.api.search(params.build())
        return (
            KrameriusDocument(response["response"]["docs"][0])
            if response["response"]["numFound"] > 0
            else None
        )

    def num_found(self, query: "SearchQuery"):
        params = SearchParams().with_query(query).with_rows(0)
        return self.api.search(params.build())["response"]["numFound"]

    def search(
        self, query: "SearchQuery", fl: Optional[List[SolrField]] = None
    ):
        params = (
            SearchParams()
            .with_query(query)
            .with_rows(PAGINATE_PAGE_SIZE)
            .with_fl(fl)
        )
        numFound = self.num_found(query)
        if numFound <= PAGINATE_PAGE_SIZE:
            for document in self.api.search(params.build())["response"][
                "docs"
            ]:
                yield KrameriusDocument(document)
            return

        params = params.with_pagination()
        while True:
            response = self.api.search(params.build())

            for document in response["response"]["docs"]:
                yield KrameriusDocument(document)

            numFound = response["response"]["numFound"]
            nextCursorMark = response["nextCursorMark"]

            if nextCursorMark == params.cursorMark:
                break
            params.with_cursor_mark(nextCursorMark)


class SearchParams:
    def __init__(self):
        self.query = "*"
        self.rows = 10
        self.start = 0
        self.fl: Optional[List[SolrField]] = None
        self.fq = None
        self.sort = None
        self.cursorMark = None

    def with_query(self, query):
        self.query = query
        return self

    def with_rows(self, rows):
        self.rows = rows
        return self

    def with_start(self, start):
        self.start = start
        return self

    def with_fl(self, fl: List[SolrField]):
        self.fl = fl
        return self

    def with_fq(self, fq):
        self.fq = fq
        return self

    def with_pagination(self):
        self.sort = "pid ASC"
        self.cursorMark = START_CURSOR_MARK
        return self

    def with_cursor_mark(self, cursorMark):
        self.cursorMark = cursorMark
        return self

    def build(self):
        return {
            "q": self.query,
            "rows": self.rows,
            "start": self.start,
            "fl": ",".join([fl.value for fl in self.fl]) if self.fl else None,
            "fq": self.fq,
            "cursorMark": self.cursorMark,
            "sort": self.sort,
        }


class SearchQuery:
    def __init__(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction = SolrConjuction.And,
    ):
        self.query_string = ""
        self.field(field, value, list_conjuction)

    def parse_value(self, value: SolrValue):
        if isinstance(value, str):
            return f'"{value}"' if value != "*" else value
        elif isinstance(value, Enum):
            return f'"{value.value}"'
        return value

    def field(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction,
    ):
        if isinstance(value, tuple):
            value_1 = self.parse_value(value[0])
            value_2 = self.parse_value(value[0])
            self.query_string += f"{field.value}:[{value_1} TO {value_2}]"
        elif isinstance(value, list):
            values = list_conjuction.join([self.parse_value(v) for v in value])
            self.query_string += f"{field.value}:({values})"
        else:
            parsed_value = self.parse_value(value)
            self.query_string += f"{field.value}:{parsed_value}"
        return self

    def and_(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction = SolrConjuction.And,
    ):
        self.query_string += SolrConjuction.And.value
        self.field(field, value, list_conjuction)
        return self

    def or_(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction = SolrConjuction.And,
    ):
        self.query_string += SolrConjuction.Or.value
        self.field(field, value, list_conjuction)
        return self

    def and_not_(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction = SolrConjuction.And,
    ):
        self.query_string += SolrConjuction.And.value
        self.query_string += "-"
        self.field(field, value, list_conjuction)
        return self

    def or_not_(
        self,
        field: SolrField,
        value: SolrValue,
        list_conjuction: SolrConjuction = SolrConjuction.And,
    ):
        self.query_string += SolrConjuction.And.value
        self.query_string += "-"
        self.field(field, value, list_conjuction)
        return self

    def sub_query(self, query: "SearchQuery"):
        self.query_string += "("
        self.query_string += query.query_string
        self.query_string += ")"
        return self

    def build(self):
        return self.query_string
