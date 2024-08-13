from typing import Optional
from ..fields_comparator import MarcFieldsComparator
from .text_data_comparator import NormalizedTextDataComparator


SYNONYMS_DICT = {
    "vyd.": "edition",
    "Vyd.": "edition",
    "vyd": "edition",
    "Vyd": "edition",
    "vydání": "edition",
    "Vydání": "edition",
    "Vydání:": "edition",
    "vydanie": "edition",
    "Vydanie": "edition",
    "nákl.": "edition",
    "dotisk": "edition",
    "dopl.": "supplement",
    "přeprac.": "revised",
    "nezm.": "unchanged",
    "první": "1.",
    "prvé": "1.",
    "druhé": "2.",
    "třetí": "3.",
    "čtvrté": "4.",
    "páte": "5.",
    "šesté": "6.",
    "I.": "1.",
    "a": "and",
    "v": "in",
    "": "",
}
VALID_FORM_PATTERN = r"^(\d+)\. edition"
REFORMAT_PATTERNS = [
    (r"edition (\d+)\.?", r"\1. edition"),
    (r"(\d+)\.?,? edition", r"\1. edition"),
    (r"(\d+)\.?,?(.*) edition", r"\1. edition, \2"),
]


class EditionFieldComparator(MarcFieldsComparator):
    def __init__(self):
        super().__init__("250", subfield_codes=["a"])
        self.text_analyzer = NormalizedTextDataComparator(
            SYNONYMS_DICT, VALID_FORM_PATTERN, REFORMAT_PATTERNS
        )

    def is_same_value(
        self, value1: Optional[str], value2: Optional[str]
    ) -> bool:
        if value1 is None and value2 is None:
            return True
        if value1 is None or value2 is None:
            return False
        if value1.strip() == value2.strip():
            return True

        return self.text_analyzer.compare_texts(value1, value2)
