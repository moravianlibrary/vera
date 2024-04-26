from pydantic import BaseModel
from typing import List, Optional
from extractions.locations.types import LocationState


class LibraryBase(BaseModel):
    id: str
    name: str


class LibraryCreate(LibraryBase):
    pass


class Library(LibraryBase):
    storages: List["Storage"] = []

    class Config:
        from_attributes = True


class StorageBase(BaseModel):
    name: str
    library_id: str


class StorageCreate(StorageBase):
    pass


class Storage(StorageBase):
    id: int
    locations: List["Location"] = []

    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    name: str
    regexp: str
    description: Optional[str]
    additional_info: Optional[str]
    state: LocationState
    storage_id: int


class LocationCreate(LocationBase):
    pass


class Location(LocationBase):
    id: int

    class Config:
        from_attributes = True
