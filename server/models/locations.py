from sqlalchemy import (
    Column,
    ForeignKey,
    Enum,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Session
from typing import List, Optional

from services.database import Base
from extractions.locations.types import LocationState


class Library(Base):
    __tablename__ = "libraries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    __table_args__ = (UniqueConstraint("name"),)

    storages = relationship("Storage", back_populates="library")

    @classmethod
    def find(cls, session: Session, library_id: int) -> Optional["Library"]:
        return session.query(cls).filter_by(id=library_id).first()

    @classmethod
    def get(cls, session: Session, library_id: int) -> "Library":
        library = cls.find(session, library_id)
        if library is None:
            raise ValueError(f"Library with id {library_id} not found")
        return library

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Library"]:
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class Storage(Base):
    __tablename__ = "storages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    library_id = Column(Integer, ForeignKey("libraries.id"), nullable=False)

    __table_args__ = (UniqueConstraint("name", "library_id"),)

    library = relationship("Library", back_populates="storages")
    locations = relationship("Location", back_populates="storage")

    @classmethod
    def find(cls, session: Session, storage_id: int) -> Optional["Storage"]:
        return session.query(cls).filter_by(id=storage_id).first()

    @classmethod
    def get(cls, session: Session, storage_id: int) -> "Storage":
        storage = cls.find(session, storage_id)
        if storage is None:
            raise ValueError(f"Storage with id {storage_id} not found")
        return storage

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Storage"]:
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


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

    @classmethod
    def find(cls, session: Session, location_id: int) -> Optional["Location"]:
        return session.query(cls).filter_by(id=location_id).first()

    @classmethod
    def get(cls, session: Session, location_id: int) -> "Location":
        location = cls.find(session, location_id)
        if location is None:
            raise ValueError(f"Location with id {location_id} not found")
        return location

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Location"]:
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()
