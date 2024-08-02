from typing import Optional
from ..fields_comparator import MarcFieldsComparator
from .text_analyzer import TextAnalyzer


EDITION_TERMS = {
    "vyd.": "edition",
    "vydání": "edition",
    "vydanie": "edition",
    "nákl.": "edition",
    "dotisk": "edition",
    "dopl.": "supplement",
    "přeprac.": "revised",
    "nezm.": "unchanged",
    "první": "1",
    "druhé": "2",
    "třetí": "3",
    "čtvrté": "4",
    "šesté": "6",
    "a": "and",
    "v": "in",
    "": "",
}
EDITION_TERMS_EXPR = (
    "(edition,any_number|any_number,edition),other_than(edition,any_number)*"
)


class EditionFieldComparator(MarcFieldsComparator):
    def __init__(self):
        super().__init__("250", subfield_codes=["a"])
        self.text_analyzer = TextAnalyzer([EDITION_TERMS])

    def is_same_value(
        self, value1: Optional[str], value2: Optional[str]
    ) -> bool:
        if value1 is None and value2 is None:
            return True
        if value1 is None or value2 is None:
            return False
        if value1.strip() == value2.strip():
            return True

        return self.text_analyzer.compare_with_expression(
            value1, value2, EDITION_TERMS_EXPR
        )
