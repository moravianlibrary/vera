from typing import Dict, List
from pymarc import Record
from .schemas import MarcFieldDifference
from .fields_comparator import MarcFieldsComparator


class MarcRecordsComparator:
    def __init__(
        self,
        tracked_fields_comparators: Dict[str, MarcFieldsComparator] = [],
        only_tracked_fields: bool = False,
        ignore_equal_fields: bool = False,
    ) -> None:
        self.tracked_fields_comparators = tracked_fields_comparators
        self.only_tracked_fields = only_tracked_fields
        self.ignore_equal_fields = ignore_equal_fields
        if ignore_equal_fields:
            for comparator in self.tracked_fields_comparators.values():
                comparator.ignore_equals = True

    def evaluate(
        self, record1: Record, record2: Record
    ) -> List[MarcFieldDifference]:
        all_tags = set(f.tag for f in record1.get_fields()).union(
            set(f.tag for f in record2.get_fields())
        )

        differences: List[MarcFieldDifference] = []

        for tag in all_tags:
            if tag in self.tracked_fields_comparators:
                differences.extend(
                    self.tracked_fields_comparators[tag].evaluate(
                        record1, record2
                    )
                )
            elif not self.only_tracked_fields:
                differences.extend(
                    MarcFieldsComparator(
                        tag, ignore_equals=self.ignore_equal_fields
                    ).evaluate(record1, record2)
                )

        return sorted(differences)
