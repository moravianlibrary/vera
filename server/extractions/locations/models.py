from sqlalchemy import (
    Column,
    ForeignKey,
    Enum,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from services.database import Base
from extractions.locations.types import LocationState


class Library(Base):
    __tablename__ = "libraries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    __table_args__ = (UniqueConstraint("name"),)

    storages = relationship("Storage", back_populates="library")


class Storage(Base):
    __tablename__ = "storages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    library_id = Column(Integer, ForeignKey("libraries.id"), nullable=False)

    __table_args__ = (UniqueConstraint("name", "library_id"),)

    library = relationship("Library", back_populates="storages")
    locations = relationship("Location", back_populates="storage")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    regexp = Column(String, nullable=False)
    description = Column(String)
    additional_info = Column(String)
    state = Column(Enum(LocationState), nullable=False)
    storage_id = Column(Integer, ForeignKey("storages.id"), nullable=False)

    __table_args__ = (UniqueConstraint("name", "storage_id"),)

    storage = relationship("Storage", back_populates="locations")
