from typing import List, Optional, Callable
from pymarc import Record, Field
from .score_functions import extended_needleman_wunsch
from .types import MarcFieldDifferenceType
from .schemas import MarcFieldDifference, MarcSubfieldDifference
from .fields_pair_matcher import MarcFieldsPairMatcher


class MarcFieldsComparator:
    def __init__(
        self,
        field_tag: str,
        ind1: Optional[str] = None,
        ind2: Optional[str] = None,
        subfield_codes: List[str] = [],
        values_score_function: Callable = extended_needleman_wunsch,
    ):
        self.field_tag = field_tag
        self.ind1 = ind1
        self.ind2 = ind2
        self.subfield_codes = set(subfield_codes)
        self.fields_pair_matcher = MarcFieldsPairMatcher(values_score_function)

    def parse_value(
        self, field: Field, subfield_code: Optional[str] = None
    ) -> Optional[str]:
        return field.get(subfield_code) if subfield_code else field.data

    def is_same_value(
        self, value1: Optional[str], value2: Optional[str]
    ) -> bool:
        if value1 is None and value2 is None:
            return True
        if value1 is None or value2 is None:
            return False
        return value1.strip() == value2.strip()

    def generate_different_fields_result(
        self, field1: Optional[Field], field2: Optional[Field]
    ) -> List[MarcFieldDifference]:
        differences = []

        if field1 is not None:
            differences.append(
                MarcFieldDifference.from_marc_field(
                    MarcFieldDifferenceType.ExtraField,
                    field1,
                    [
                        MarcSubfieldDifference(
                            code=subfield.code, value=subfield.value
                        )
                        for subfield in field1
                    ],
                )
            )
        if field2 is not None:
            differences.append(
                MarcFieldDifference.from_marc_field(
                    MarcFieldDifferenceType.MissingField,
                    field2,
                    [
                        MarcSubfieldDifference(
                            code=subfield.code, different_to=subfield.value
                        )
                        for subfield in field2
                    ],
                )
            )

        return differences

    def generate_same_fields_result(
        self,
        field1: Field,
        subfield_differences: List[MarcSubfieldDifference],
        subfields_differ: bool,
    ) -> List[MarcFieldDifference]:
        if subfields_differ:
            return [
                MarcFieldDifference.from_marc_field(
                    MarcFieldDifferenceType.DifferentValue,
                    field1,
                    subfield_differences,
                )
            ]
        return [
            MarcFieldDifference.from_marc_field(
                MarcFieldDifferenceType.Equal,
                field1,
                subfield_differences,
            )
        ]

    def evaluate_single_field(
        self, field1: Field, field2: Field
    ) -> List[MarcFieldDifference]:
        if field1.is_control_field():
            differs = not self.is_same_value(field1.data, field2.data)
            return self.generate_same_fields_result(
                field1,
                [
                    MarcSubfieldDifference(
                        value=field1.data,
                        different_to=field2.data,
                        differs=differs,
                    )
                ],
                differs,
            )

        if field1.indicators != field2.indicators:
            return self.generate_different_fields_result(field1, field2)

        subfield_differences: List[MarcSubfieldDifference] = []
        subfields_differ = False

        subfield_codes = (
            self.subfield_codes
            if self.subfield_codes
            else (
                set(s.code for s in field1.subfields).union(
                    set(s.code for s in field1.subfields)
                )
            )
        )

        for subfield_code in subfield_codes:
            value1 = self.parse_value(field1, subfield_code)
            value2 = self.parse_value(field2, subfield_code)

            differs = not self.is_same_value(value1, value2)
            subfield_differences.append(
                MarcSubfieldDifference(
                    code=subfield_code,
                    value=value1,
                    different_to=value2,
                    differs=differs,
                )
            )

            if differs:
                subfields_differ = True

        return self.generate_same_fields_result(
            field1, subfield_differences, subfields_differ
        )

    def evaluate_multiple_fields(
        self, fields1: List[Field], fields2: List[Field]
    ) -> List[MarcFieldDifference]:
        differences = []

        for matched_pair in self.fields_pair_matcher.pair_closest(
            fields1, fields2
        ):
            field1, field2 = matched_pair.item1, matched_pair.item2
            if field1 and field2:
                differences.extend(self.evaluate_single_field(field1, field2))
            elif field1 is not None or field2 is not None:
                differences.extend(
                    self.generate_different_fields_result(field1, field2)
                )

        return differences

    def evaluate(
        self, record1: Record, record2: Record
    ) -> List[MarcFieldDifference]:
        fields1 = record1.get_fields(self.field_tag)
        fields2 = record2.get_fields(self.field_tag)

        if len(fields1) == 1 and len(fields2) == 1:
            return self.evaluate_single_field(fields1[0], fields2[0])
        if len(fields1) >= 1 or len(fields2) >= 1:
            return self.evaluate_multiple_fields(fields1, fields2)
        return []
