from sqlalchemy.orm import Session
from sqlalchemy import update
from typing import List

from services.database import create
from extractions.locations import schemas
from models import Location, Library, Storage


# Create
def create_library(library: schemas.LibraryCreate, db: Session):
    return create(db, Library(name=library.name))


def create_storage(storage: schemas.StorageCreate, db: Session):
    return create(
        db, Storage(library_id=storage.library_id, name=storage.name)
    )


def create_location(location: schemas.LocationCreate, db: Session):
    return create(
        db,
        Location(
            storage_id=location.storage_id,
            name=location.name,
            regexp=location.regexp,
            description=location.description,
            additional_info=location.additional_info,
            state=location.state,
        ),
    )


# Select
def get_library(library_id: str, db: Session) -> Library:
    return db.query(Library).filter(Library.id == library_id).first()


def get_storage(storage_id: int, db: Session) -> Storage:
    return db.query(Storage).filter(Storage.id == storage_id).first()


def get_location(location_id: int, db: Session) -> Location:
    return db.query(Location).filter(Location.id == location_id).first()


# Update
def update_library(
    library_id: str, library: schemas.LibraryCreate, db: Session
) -> Library:
    db.execute(
        update(Library)
        .where(Library.id == library_id)
        .values(name=library.name)
    )
    db.commit()
    return get_library(library_id, db)


def update_storage(
    storage_id: int, storage: schemas.StorageCreate, db: Session
) -> Storage:
    db.execute(
        update(Storage)
        .where(Storage.id == storage_id)
        .values(library_id=storage.library_id, name=storage.name)
    )
    db.commit()
    return get_storage(storage_id, db)


def update_location(
    location_id: int, location: schemas.LocationCreate, db: Session
) -> Location:
    db.execute(
        update(Location)
        .where(Location.id == location_id)
        .values(
            storage_id=location.storage_id,
            name=location.name,
            regexp=location.regexp,
            description=location.description,
            additional_info=location.additional_info,
            state=location.state,
        )
    )
    db.commit()
    return get_location(location_id, db)


# Delete
def delete_library(id: str, db: Session) -> Library:
    library = get_library(id, db)
    db.delete(library)
    db.commit()
    return library


def delete_storage(id: int, db: Session) -> Storage:
    storage = get_storage(id, db)
    db.delete(storage)
    db.commit()
    return storage


def delete_location(id: int, db: Session) -> Location:
    location = get_location(id, db)
    db.delete(location)
    db.commit()
    return location


# Select all
def get_libraries(db: Session) -> List[Library]:
    return db.query(Library).all()


def get_storages(db: Session) -> List[Storage]:
    return db.query(Storage).all()


def get_locations(db: Session) -> List[Location]:
    return db.query(Location).all()


def get_location_pattern(location_id: int, db: Session):
    location = (
        db.query(Location.regexp).filter(Location.id == location_id).first()
    )
    if not location:
        return None
    pattern = location.regexp.replace(".", "\\.")
    return f"^{pattern}-.*$"
