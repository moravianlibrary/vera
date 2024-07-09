from enum import Enum
from pydantic import BaseModel
from typing import Optional


class IdentifierType(Enum):
    Sysno = "Sysno"
    Barcode = "Barcode"
    Signature = "Signature"
    Cnb = "Cnb"
    Isxn = "Isxn"


class Frequency(BaseModel):
    frequency: str
    date: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True
