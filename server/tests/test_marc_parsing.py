from unittest import TestCase
from services.marc_comparator.special_comparators.text_data_comparator import (
    NormalizedTextDataComparator,
)
from services.marc_comparator.score_functions import extended_needleman_wunsch
from services.marc_comparator.special_comparators.edition import (
    EditionFieldComparator,
)
from services.marc_comparator.special_comparators.general_information import (
    GeneralInformationComparator,
    Marc008Field,
)
from services.marc_comparator import (
    MarcFieldDifference,
    MarcFieldDifferenceType,
    MarcSubfieldDifference,
)
from pymarc import Field, Record, Subfield
from typing import Optional
from tasks.subtasks.catalog_record_differences import MzkSkcRecordsComparator


class TestMarcFieldDifferenceType(TestCase):
    def test_ordering(self):
        self.assertLess(
            MarcFieldDifferenceType.DifferentValue,
            MarcFieldDifferenceType.Equal,
        )


class TestMarcComparatorScoringFunctions(TestCase):
    def test_extended_needleman_wunsch_with_none(self):
        self.assertEqual(extended_needleman_wunsch(None, None), 1)
        self.assertEqual(extended_needleman_wunsch(None, "text"), -1)
        self.assertEqual(extended_needleman_wunsch("text", None), -1)

    def test_extended_needleman_wunsch_equal_values(self):
        self.assertEqual(extended_needleman_wunsch("text", "text"), 4)

    def test_extended_needleman_wunsch_different_values(self):
        self.assertEqual(extended_needleman_wunsch("teXxt", "text2"), 2)


class TestMarcComparatorEditionFieldComparator(TestCase):
    def setUp(self) -> None:
        self.comparator = EditionFieldComparator()

    def create_test_record(self, value: Optional[str] = None) -> Record:
        if value is None:
            return Record()
        record = Record()
        record.add_field(
            Field(tag="250", subfields=[Subfield(code="a", value=value)])
        )
        return record

    def test_comparator_with_none(self):
        self.assertTrue(self.comparator.is_same_value(None, None))
        self.assertFalse(self.comparator.is_same_value(None, "text"))
        self.assertFalse(self.comparator.is_same_value("text", None))
        self.assertTrue(self.comparator.is_same_value(" text", "text "))

        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record(), self.create_test_record()
            ),
            [],
        )
        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record("text"), self.create_test_record()
            ),
            [
                MarcFieldDifference(
                    difference_type=MarcFieldDifferenceType.ExtraField,
                    tag="250",
                    subfield_differences=[
                        MarcSubfieldDifference(code="a", value="text")
                    ],
                )
            ],
        )
        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record(), self.create_test_record("text")
            ),
            [
                MarcFieldDifference(
                    difference_type=MarcFieldDifferenceType.MissingField,
                    tag="250",
                    subfield_differences=[
                        MarcSubfieldDifference(code="a", different_to="text")
                    ],
                )
            ],
        )

    def test_comparator_with_equal_values(self):
        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record("text"),
                self.create_test_record("text"),
            ),
            [
                MarcFieldDifference(
                    difference_type=MarcFieldDifferenceType.Equal,
                    tag="250",
                    subfield_differences=[
                        MarcSubfieldDifference(
                            code="a",
                            value="text",
                            different_to="text",
                            differs=False,
                        )
                    ],
                )
            ],
        )


class TestMarcComparatorGeneralInformationFieldComparator(TestCase):
    def setUp(self) -> None:
        self.comparator = GeneralInformationComparator()

    def create_test_record(self, value: str) -> Record:
        record = Record()
        record.add_field(Field(tag="008", data=value))
        return record

    def test_general_information_field_parsing(self):
        field = Marc008Field("960815s1996    xr ab  e          1acze d")
        self.assertEqual(field.date_entered, "960815")
        self.assertEqual(field.date1, "1996")
        self.assertEqual(field.date2, "    ")
        self.assertEqual(field.place_of_publication, "xr ")
        self.assertEqual(field.language, "cze")

    def test_is_same_general_information_value_with_none_values(self):
        self.assertTrue(self.comparator.is_same_value(None, None))
        self.assertFalse(self.comparator.is_same_value(None, "text"))
        self.assertFalse(self.comparator.is_same_value("text", None))
        self.assertTrue(
            self.comparator.is_same_value(
                "960815s1996 -  xr ab- e          1acze d",
                "960815s1996  - xr cd- e          1acze d",
            )
        )

    def test_general_information_field_comparator_evaluation_equal_values(
        self,
    ):
        value1 = "960815s1996 -  xr ab- e          1acze d"
        value2 = "960815s1996  - xr cd- e          1acze d"
        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record(value1),
                self.create_test_record(value2),
            ),
            [
                MarcFieldDifference(
                    difference_type=MarcFieldDifferenceType.Equal,
                    tag="008",
                    subfield_differences=[
                        MarcSubfieldDifference(
                            code=None,
                            value=value1,
                            different_to=value2,
                            differs=False,
                        )
                    ],
                    control_field=True,
                )
            ],
        )

    def test_general_information_field_comparator_evaluation_different_values(
        self,
    ):
        value1 = "960815s1996 -  xr ab- e          1acze d"
        value2 = "960815s1996  - xr cd- e          1aeng d"
        self.assertEqual(
            self.comparator.evaluate(
                self.create_test_record(value1),
                self.create_test_record(value2),
            ),
            [
                MarcFieldDifference(
                    difference_type=MarcFieldDifferenceType.DifferentValue,
                    tag="008",
                    subfield_differences=[
                        MarcSubfieldDifference(
                            code=None, value=value1, different_to=value2
                        )
                    ],
                    control_field=True,
                )
            ],
        )


# TODO: Refactor - reorganize to specific test cases
class TestNormalizedTextDataComparator(TestCase):
    def test_tokenization_with_simple_synonyms_exact_match(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern
        )
        text = "první vydání"

        # Act
        tokens = analyzer._tokenize(text)

        # Assert
        self.assertEqual(tokens, ["první", "vydání"])

    def test_normalization_with_simple_synonyms_exact_match(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern
        )
        text = "první vydání"

        # Act
        classification = analyzer._normalize_text(text)

        # Assert
        self.assertEqual(classification, "1. edition")

    def test_normalization_with_simple_synonyms_no_match(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern
        )
        text = "prví vydání"

        # Act
        classification = analyzer._normalize_text(text)

        # Assert
        self.assertIsNone(classification)

    def test_normalization_with_simple_synonyms_reformat_match(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        reformat_patterns = [
            (
                r"edition (\d+)\.",
                r"\1. edition",
            )
        ]
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern, reformat_patterns
        )
        text = "vydání 2."

        # Act
        classification = analyzer._normalize_text(text)

        # Assert
        self.assertEqual(classification, "2. edition")

    def test_normalization_with_simple_synonyms_reformat_match_2(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        reformat_patterns = [(r"edition (\d+)", r"\1. edition")]
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern, reformat_patterns
        )
        text = "vydání 1"

        # Act
        classification = analyzer._normalize_text(text)

        # Assert
        self.assertEqual(classification, "1. edition")

    def test_compare_using_expression_with_simple_synonyms_exact_match(self):
        # Arrange
        synonym_dict = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        valid_form_pattern = r"^(\d+)\. edition"
        reformat_patterns = [(r"edition (\d+)\.", r"\1. edition")]
        analyzer = NormalizedTextDataComparator(
            synonym_dict, valid_form_pattern, reformat_patterns
        )

        text1 = "první vydání"
        text2 = "vydání 1."

        # Act
        are_same = analyzer.compare_texts(text1, text2)

        # Assert
        self.assertTrue(are_same)

    def test_edition_field_comparator(self):
        # Arrange
        comparator = EditionFieldComparator()
        values = [
            ("Vyd. 2., v češ. 1.", "Vyd. 2., v češtině 1."),
            ("3. dopl. a přeprac. vyd.", "3., dopl. a přeprac. vyd."),
            ("2. vyd.", "2. vyd"),
            ("2. přeprac. vyd.", "2., přeprac. vyd."),
        ]

        # Act and Assert
        for value1, value2 in values:
            self.assertTrue(comparator.is_same_value(value1, value2))

    def test_skc_record_comparator(self):
        # Arrange
        record1 = Record()
        record1.add_field(
            Field(tag="300", subfields=[Subfield(code="a", value="52 svazků")])
        )
        record2 = Record()
        record2.add_field(
            Field(tag="300", subfields=[Subfield(code="a", value="  sv. ;")])
        )

        # Act and Assert
        self.assertEqual(
            MzkSkcRecordsComparator.evaluate(record1, record2),
            [
                MarcFieldDifference(
                    tag="300",
                    indicator1=None,
                    indicator2=None,
                    control_field=False,
                    difference_type="DifferentValue",
                    subfield_differences=[
                        MarcSubfieldDifference(
                            code="a",
                            value="52 svazků",
                            different_to="  sv. ;",
                            differs=True,
                        ),
                    ],
                )
            ],
        )

    def test_skc_record_comparator_for_control_field(self):
        # Arrange
        record1 = Record()
        record1.add_field(Field(tag="008", data="same_value"))
        record2 = Record()
        record2.add_field(Field(tag="008", data="same_value"))

        # Act and Assert
        self.assertEqual(
            MzkSkcRecordsComparator.evaluate(record1, record2), []
        )
