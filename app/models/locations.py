from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.ext.hybrid import hybrid_property
from .base import BaseModel


class Location(BaseModel):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    name = Column(String, nullable=False, unique=True)
    regexp = Column(String, nullable=False)
    description = Column(String)
    included_in = Column(JSON)

    @hybrid_property
    def pattern(self) -> str:
        return f"^{self.regexp.replace(".", "\\.")}-.*$"
