from pydantic import BaseModel

from catalogs.enums import IdentifierType


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str
