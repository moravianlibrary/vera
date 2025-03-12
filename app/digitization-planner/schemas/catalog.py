from typing import List, Optional, Dict, Any
from pydantic import BaseModel

# from pydantic import BaseModel, model_validator
# from typing_extensions import Annotated
# import json
# from jsonschema import validate, ValidationError as JsonSchemaValidationError
from custom_types import CatalogFetchStatus


type Record = Dict


class CatalogGetResponse(BaseModel):
    record: Optional[Record] = None
    status: CatalogFetchStatus


class CatalogSearchItem(BaseModel):
    base: str
    system_number: str
    record: Record


class CatalogSearchResponse(BaseModel):
    items: Optional[List[CatalogSearchItem]] = None
    num_found: int
    status: CatalogFetchStatus


class CatalogSearchParams(BaseModel):
    value: str
    base: Optional[str] = None
    field: Optional[str] = None
    page: int
    page_size: int


# class RecordSchemaValidator(BaseModel):
#     schema: dict

#     def __init__(self, **kwargs):
#         super().__init__(**kwargs)
#         self.schema = self.load_json_schema("record.schema.json")

#     @staticmethod
#     def load_json_schema(file_path: str) -> dict:
#         with open(file_path, "r") as file:
#             return json.load(file)

#     def validate_with_schema(self, data: dict):
#         try:
#             validate(instance=data, schema=self.schema)
#         except JsonSchemaValidationError as e:
#             raise ValueError(
#                 f"Data does not conform to the schema: {e.message}"
#             )

#     @model_validator(mode="before")
#     def validate_data(cls, values):
#         data = values.get("data")
#         cls.validate_with_schema(data)
#         return values


# Record = Annotated[dict, RecordSchemaValidator]
Record = Dict[str, Any]
Issue = Dict[str, Any]
