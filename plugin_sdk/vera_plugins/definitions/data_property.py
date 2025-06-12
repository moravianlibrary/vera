from typing import Dict, List, Literal, TypeVar

from pydantic import BaseModel

# --- JSON Type Aliases ---
JSONScalar = str | int | float | bool | None
JSONType = JSONScalar | List["JSONType"] | Dict[str, "JSONType"]

InputType = TypeVar("InputType")
PropertyType = TypeVar("PropertyType", bound=JSONType)
ExtractedProperties = Dict[str, JSONType]


# --- JSON Schema-like Type Definitions for Plugin Configs ---
class StringType(BaseModel):
    type: Literal["string"]


class NumberType(BaseModel):
    type: Literal["number"]


class BooleanType(BaseModel):
    type: Literal["boolean"]


class NullType(BaseModel):
    type: Literal["null"]


class IntegerType(BaseModel):
    type: Literal["integer"]


class ArrayType(BaseModel):
    type: Literal["array"]
    items: "PropertyTypeSchema"


class ObjectType(BaseModel):
    type: Literal["object"]
    properties: Dict[str, "PropertyTypeSchema"]


PropertyTypeSchema = (
    StringType
    | NumberType
    | BooleanType
    | NullType
    | IntegerType
    | ArrayType
    | ObjectType
)

ArrayType.model_rebuild()
ObjectType.model_rebuild()
