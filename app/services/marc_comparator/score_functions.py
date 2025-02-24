import numpy as np
from typing import Optional


def needleman_wunsch(seq1: str, seq2: str) -> int:
    # Define scoring and gap penalty
    match_score = 1
    mismatch_score = -1
    gap_penalty = -1

    len_seq1 = len(seq1)
    len_seq2 = len(seq2)

    # Initialize scoring matrix
    dp = np.zeros((len_seq1 + 1, len_seq2 + 1), dtype=int)

    # Fill in the gap penalties
    for i in range(len_seq1 + 1):
        dp[i][0] = i * gap_penalty
    for j in range(len_seq2 + 1):
        dp[0][j] = j * gap_penalty

    # Fill in the scoring matrix
    for i in range(1, len_seq1 + 1):
        for j in range(1, len_seq2 + 1):
            match = dp[i - 1][j - 1] + (
                match_score if seq1[i - 1] == seq2[j - 1] else mismatch_score
            )
            delete = dp[i - 1][j] + gap_penalty
            insert = dp[i][j - 1] + gap_penalty
            dp[i][j] = max(match, delete, insert)

    return dp[len_seq1][len_seq2]


def extended_needleman_wunsch(
    value1: Optional[str], value2: Optional[str]
) -> bool:
    if value1 is None and value2 is None:
        return 1
    if value1 is None or value2 is None:
        return -1
    if value1 == value2:
        return len(value1)
    return needleman_wunsch(value1, value2)
