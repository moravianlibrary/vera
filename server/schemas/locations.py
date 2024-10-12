from pydantic import BaseModel
from typing import Optional
from datatypes import LocationState
from models import Library, Storage, Location


class LibraryCreate(BaseModel):
    name: str

    def load_to_model(self, model: Library) -> Library:
        model.name = self.name
        return model


class LibraryResponse(LibraryCreate):
    id: int

    class Config:
        from_attributes = True


class StorageCreate(BaseModel):
    name: str
    library_id: int

    def load_to_model(self, model: Storage) -> Storage:
        model.name = self.name
        model.library_id = self.library_id
        return model


class StorageResponse(StorageCreate):
    id: int
    library: Optional["LibraryResponse"] = None

    class Config:
        from_attributes = True


class LocationCreate(BaseModel):
    name: str
    regexp: str
    description: Optional[str]
    additional_info: Optional[str]
    state: LocationState
    storage_id: int

    def load_to_model(self, model: Location) -> Location:
        model.name = self.name
        model.regexp = self.regexp
        model.description = self.description
        model.additional_info = self.additional_info
        model.state = self.state
        model.storage_id = self.storage_id
        return model


class LocationResponse(LocationCreate):
    id: int

    storage: Optional["StorageResponse"] = None

    class Config:
        from_attributes = True
