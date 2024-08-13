from unittest import TestCase
from services.marc_records_comparator.special_comparators.text_analyzer import TextAnalyzer


class TestTextAnalyzer(TestCase):
    def test_tokenization_with_simple_vocabulary_exact_match(self):
        # Arrange
        vocabulary = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        analyzer = TextAnalyzer(vocabulary)
        text = "první vydání"
        
        # Act
        tokens = analyzer._tokenize(text)

        # Assert
        self.assertEqual(tokens, ['první', 'vydání'])
        
    def test_classification_with_simple_vocabulary_exact_match(self):
        # Arrange
        vocabulary = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        analyzer = TextAnalyzer(vocabulary)
        text = "první vydání"
        
        # Act
        classification = analyzer._classify(text)

        # Assert
        self.assertEqual(classification, ['1.', 'edition'])
        
    def test_compare_using_expression_with_simple_vocabulary_exact_match(self):
        # Arrange
        vocabulary = {
            "vydání": "edition",
            "vydanie": "edition",
            "první": "1.",
            "druhé": "2.",
        }
        analyzer = TextAnalyzer(vocabulary)
        text1 = "první vydání"
        text2 = "vydání 1."
        editions_terms_expr = (
            "edition,any_number,other_than(edition,any_number)*|"
            "any_number,edition,other_than(edition,any_number)*"
        )
        
        # Act
        are_same = analyzer.compare_using_expression(text1, text2, editions_terms_expr)

        # Assert
        self.assertTrue(are_same)
        