from typing import List, Dict, Tuple, Optional
import re
from sklearn.feature_extraction.text import CountVectorizer


ARABIC_SEQUENCE_NUMBER_CLASS = "arabic_sequence_number"
ARABIC_NUMBER_CLASS = "arabic_number"
ROMAN_NUMBER_CLASS = "roman_number"


class TextAnalyzer:
    def __init__(self, vocabulary: Dict[str, str], 
                 tokenize_regexp=r"\b\w+\b") -> None:
        self._vocabulary = vocabulary
        self._tokenize_regexp = tokenize_regexp

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(self._tokenize_regexp, text) if text else []
    
    def _evaluate_token_class(self, token: str) -> Optional[str]:
        match_ = re.match(r"\d+\.", token)
        if match_:
            return match_.group(0) 
        match_ = re.match(r"\d+", token)
        if match_:
            return match_.group(0) 
        return self._vocabulary.get(token)
    
    def _classify(self, text: str) -> List[Tuple[str, Optional[str]]]:
        return [
            self._evaluate_token_class(token)
            for token in self._tokenize(text)
            ]

    def compare_using_expression(
        self, text1: str, text2: str, terms_expression: str
    ) -> bool:
        tokens1 = self._classify(text1)
        tokens2 = self._classify(text2)
