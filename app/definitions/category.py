from enum import Enum
from typing import Literal

Level = Literal[1, 2, 3, 4]
ALLOWED_LEVELS = {1, 2, 3, 4}


class CategoryDocumentFilter(str, Enum):
    All = "All"
    Extractable = "Extractable"
    Extracted = "Extracted"
