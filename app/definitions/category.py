from enum import Enum
from typing import Literal

MAX_LEVEL = 3

Level = Literal[0, 1, 2, 3]


class CategoryDocumentFilter(str, Enum):
    All = "All"
    Extractable = "Extractable"
    Extracted = "Extracted"
