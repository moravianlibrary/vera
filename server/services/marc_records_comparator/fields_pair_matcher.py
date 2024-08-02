from typing import TypeVar, List, Tuple, Optional, Callable
from pymarc import Field
import numpy as np
from scipy.optimize import linear_sum_assignment
from .schemas import MatchedPair


T = TypeVar("T")

MISSING_VALUE_SCORE = -1


class MarcFieldsPairMatcher:
    def __init__(self, values_score_function: Callable):
        self.values_score_function = values_score_function

    def pair_closest_generic(
        self, items1: List[T], items2: List[T], score_function: Callable
    ) -> List[Tuple[Optional[T], Optional[T]]]:
        score_matrix = np.zeros((len(items1), len(items2)))

        for i, item1 in enumerate(items1):
            for j, item2 in enumerate(items2):
                score_matrix[i, j] = score_function(item1, item2)

        row_ind, col_ind = linear_sum_assignment(-score_matrix)

        paired_items: List[MatchedPair] = []
        paired_items1 = set()
        paired_items2 = set()

        for i, j in zip(row_ind, col_ind):
            if i < len(items1) and j < len(items2):
                paired_items.append(
                    MatchedPair(
                        item1=items1[i],
                        item2=items2[j],
                        score=score_matrix[i, j],
                    )
                )
                paired_items1.add(i)
                paired_items2.add(j)
            else:
                print(
                    f"Error: i={i}, j={j}, "
                    f"len(items1)={len(items1)}, "
                    f"len(items2)={len(items2)}"
                )

        for i in range(len(items1)):
            if i not in paired_items1:
                paired_items.append(
                    MatchedPair(item1=items1[i], score=MISSING_VALUE_SCORE)
                )

        for j in range(len(items2)):
            if j not in paired_items2:
                paired_items.append(
                    MatchedPair(item2=items2[j], score=MISSING_VALUE_SCORE)
                )

        return paired_items

    def pair_closest_subfield_values(
        self, subfields1: List[str], subfields2: List[str]
    ) -> List[MatchedPair]:
        return self.pair_closest_generic(
            subfields1, subfields2, self.values_score_function
        )

    def pair_closest(
        self, fields1: List[Field], fields2: List[Field]
    ) -> List[MatchedPair]:
        def calculate_fields_match_score(field1: Field, field2: Field):
            return sum(
                matched_pair.score
                for subfield_code in set(
                    s.code for s in field1.subfields
                ).union(set(s.code for s in field2.subfields))
                for matched_pair in self.pair_closest_subfield_values(
                    field1.get_subfields(subfield_code),
                    field2.get_subfields(subfield_code),
                )
            )

        return self.pair_closest_generic(
            fields1, fields2, calculate_fields_match_score
        )
