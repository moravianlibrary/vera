from typing import List

from pydantic import BaseModel


# --------------------
# - Request Payloads -
# --------------------
class CategoryProportionEdit(BaseModel):
    category_id: int
    proportion: float


class CategoryProportionNode(CategoryProportionEdit):
    children: List["CategoryProportionNode"] = []


class DistributionEdit(BaseModel):
    name: str
    description: str | None = None


class DistributionEditWithProportions(DistributionEdit):
    proportions: List[CategoryProportionNode]


# -----------------
# - API Responses -
# -----------------
class Distribution(DistributionEdit):
    id: int
    is_active: bool
