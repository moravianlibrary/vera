from unittest import TestCase
from services.marc_records_comparator.special_comparators.text_data_comparator import (
    NormalizedTextDataComparator,
)
from services.marc_records_comparator.special_comparators.edition import (
    EditionFieldComparator,
)


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
