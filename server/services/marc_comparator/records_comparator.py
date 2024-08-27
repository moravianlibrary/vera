from typing import Dict, List
from pymarc import Record
from .schemas import MarcFieldDifference
from .fields_comparator import MarcFieldsComparator


class MarcRecordsComparator:
    def __init__(
        self, tracked_fields_comparators: Dict[str, MarcFieldsComparator] = []
    ) -> None:
        self.tracked_fields_comparators = tracked_fields_comparators

    def evaluate(
        self,
        record1: Record,
        record2: Record,
        only_tracked_fields: bool = False,
    ) -> List[MarcFieldDifference]:
        all_tags = set(f.tag for f in record1.get_fields()).union(
            set(f.tag for f in record2.get_fields())
        )

        differences = []

        for tag in all_tags:
            if tag in self.tracked_fields_comparators:
                differences.extend(
                    self.tracked_fields_comparators[tag].evaluate(
                        record1, record2
                    )
                )
            elif not only_tracked_fields:
                differences.extend(
                    MarcFieldsComparator(tag).evaluate(record1, record2)
                )

        return sorted(differences)
