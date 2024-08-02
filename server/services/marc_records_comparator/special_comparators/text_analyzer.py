from typing import List, Dict
import re


class TextAnalyzer:
    def __init__(self, terms_packs: List[Dict[str, str]]) -> None:
        self.terms_packs = terms_packs

    def tokenize(self, text: str) -> List[str]:
        return re.findall(r"\b\w+\b", text) if text else []

    def compare_with_expression(
        self, text1: str, text2: str, terms_expression: str
    ) -> bool:
        tokens1 = self.tokenize(text1)
        print(tokens1)
        pass
