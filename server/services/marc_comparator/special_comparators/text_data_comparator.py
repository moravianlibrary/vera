from typing import List, Dict, Tuple, Optional
import re


VALUE_TERM_TYPES = ["sequence_number", "number"]


class NormalizedTextDataComparator:
    def __init__(
        self,
        synonym_dict: Dict[str, str],
        valid_form_pattern: str,
        reformat_patterns: List[Tuple[str, str]] = [],
        tokenize_pattern=r"\w+[\.]?",
    ) -> None:
        self._synonym_dict = synonym_dict
        self._valid_form_pattern = valid_form_pattern
        self._reformat_patterns = reformat_patterns
        self._tokenize_pattern = tokenize_pattern

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(self._tokenize_pattern, text) if text else []

    def _replace_synonym(self, term: str) -> Tuple[str, Optional[str]]:
        if re.fullmatch(r"\d+\.", term):
            return term, "sequence_number"
        if re.fullmatch(r"\d+", term):
            return term, "number"

        standardized_term = self._synonym_dict.get(term)
        if standardized_term is None:
            return term, None

        restandardized_term = self._replace_synonym(standardized_term)
        if restandardized_term[1]:
            return restandardized_term
        return term, standardized_term

    def _normalize_text(self, text: str) -> str:
        def parse_token(token: Tuple[str, str]) -> str:
            if token[1] is None:
                return token[0]
            if token[1] in VALUE_TERM_TYPES:
                return token[0]
            return token[1]

        terms = [
            self._replace_synonym(token) for token in self._tokenize(text)
        ]
        normalized_text = " ".join(parse_token(term) for term in terms)

        if re.match(self._valid_form_pattern, normalized_text):
            return normalized_text

        for pattern, replacement in self._reformat_patterns:
            match = re.match(pattern, normalized_text)
            if match:
                return match.expand(replacement)

        return None

    def compare_texts(self, text1: str, text2: str) -> bool:
        normalized_text1 = self._normalize_text(text1)
        normalized_text2 = self._normalize_text(text2)

        return (
            normalized_text1 is not None
            and normalized_text2 is not None
            and normalized_text1 == normalized_text2
        )
