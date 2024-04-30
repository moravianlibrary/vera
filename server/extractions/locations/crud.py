from sqlalchemy.orm import Session
from sqlalchemy import update
from typing import List

from services.database import create
from extractions.locations import models
from extractions.locations import schemas


# Create
def create_library(library: schemas.LibraryCreate, db: Session):
    return create(db, models.Library(name=library.name))


def create_storage(storage: schemas.StorageCreate, db: Session):
    return create(
        db, models.Storage(library_id=storage.library_id, name=storage.name)
    )


def create_location(location: schemas.LocationCreate, db: Session):
    return create(
        db,
        models.Location(
            storage_id=location.storage_id,
            name=location.name,
            regexp=location.regexp,
            description=location.description,
            additional_info=location.additional_info,
            state=location.state,
        ),
    )


# Select
def get_library(library_id: str, db: Session) -> models.Library:
    return (
        db.query(models.Library)
        .filter(models.Library.id == library_id)
        .first()
    )


def get_storage(storage_id: int, db: Session) -> models.Storage:
    return (
        db.query(models.Storage)
        .filter(models.Storage.id == storage_id)
        .first()
    )


def get_location(location_id: int, db: Session) -> models.Location:
    return (
        db.query(models.Location)
        .filter(models.Location.id == location_id)
        .first()
    )


# Update
def update_library(
    library_id: str, library: schemas.LibraryCreate, db: Session
) -> models.Library:
    db.execute(
        update(models.Library)
        .where(models.Library.id == library_id)
        .values(name=library.name)
    )
    db.commit()
    return get_library(library_id, db)


def update_storage(
    storage_id: int, storage: schemas.StorageCreate, db: Session
) -> models.Storage:
    db.execute(
        update(models.Storage)
        .where(models.Storage.id == storage_id)
        .values(name=storage.name)
    )
    db.commit()
    return get_storage(storage_id, db)


def update_location(
    location_id: int, location: schemas.LocationCreate, db: Session
) -> models.Location:
    db.execute(
        update(models.Location)
        .where(models.Location.id == location_id)
        .values(
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
def delete_library(id: str, db: Session) -> models.Library:
    db.delete(get_library(id, db))
    db.commit()
    return get_library(id, db)


def delete_storage(id: int, db: Session) -> models.Storage:
    db.delete(get_storage(id, db))
    db.commit()
    return get_storage(id, db)


def delete_location(id: int, db: Session) -> models.Location:
    db.delete(get_location(id, db))
    db.commit()
    return get_location(id, db)


# Select all
def get_libraries(db: Session) -> List[models.Library]:
    return db.query(models.Library).all()


def get_storages(db: Session) -> List[models.Storage]:
    return db.query(models.Storage).all()


def get_locations(db: Session) -> List[models.Location]:
    return db.query(models.Location).all()
