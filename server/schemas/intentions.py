from pydantic import BaseModel, model_validator
from typing import Any, Optional
from datetime import date
from datatypes import IntentionClassification
from models import Intention
from .base_es_model import BaseEsModel, Integer, Keyword, Date, Text


class IntentionCreate(BaseModel):
    name: str
    description: Optional[str] = None

    target_page_count: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    # TODO: model validation


class IndexIntention(BaseEsModel):
    __index_name__ = "intentions"

    id: Integer
    name: Keyword
    description: Optional[Text] = None

    target_page_count: Optional[Integer] = None
    start_date: Optional[Date] = None
    end_date: Optional[Date] = None

    classificaton: IntentionClassification

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, Intention):
            return data

        data: Intention

        return cls(
            id=data.id,
            name=data.name,
            description=data.description,
            target_page_count=data.target_page_count,
            start_date=data.start_date.isoformat(),
            end_date=data.end_date.isoformat(),
            classificaton=IntentionClassification.dispatch(
                data.target_page_count, data.start_date, data.end_date
            ),
        )
