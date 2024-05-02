from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from extractions.locations import schemas, crud
from services.database import get_db

router = APIRouter(prefix="/locations", tags=["Locations"])


# Create
@router.post("/libraries", response_model=schemas.Library)
def create_library(
    library: schemas.LibraryCreate, db: Session = Depends(get_db)
):
    return crud.create_library(library, db)


@router.post("/storages", response_model=schemas.Storage)
def create_storage_for_library(
    storage: schemas.StorageCreate,
    db: Session = Depends(get_db),
):
    return crud.create_storage(storage, db)


@router.post("/locations", response_model=schemas.Location)
def create_location_for_storage(
    location: schemas.LocationCreate,
    db: Session = Depends(get_db),
):
    return crud.create_location(location, db)


# Update
@router.put("/libraries/{library_id}", response_model=schemas.Library)
def update_library(
    library_id: str,
    library: schemas.LibraryCreate,
    db: Session = Depends(get_db),
):
    return crud.update_library(library_id, library, db)


@router.put("/storages/{storage_id}", response_model=schemas.Storage)
def update_storage(
    storage_id: int,
    storage: schemas.StorageCreate,
    db: Session = Depends(get_db),
):
    return crud.update_storage(storage_id, storage, db)


@router.put("/locations/{location_id}", response_model=schemas.Location)
def update_location(
    location_id: int,
    location: schemas.LocationCreate,
    db: Session = Depends(get_db),
):
    return crud.update_location(location_id, location, db)


# Delete
@router.delete("/libraries/{library_id}", response_model=schemas.Library)
def delete_library(library_id: str, db: Session = Depends(get_db)):
    db_library = crud.delete_library(library_id, db)
    if db_library is None:
        raise HTTPException(status_code=404, detail="Library not found")
    return db_library


@router.delete("/storages/{storage_id}", response_model=schemas.Storage)
def delete_storage(storage_id: int, db: Session = Depends(get_db)):
    db_storage = crud.delete_storage(storage_id, db)
    if db_storage is None:
        raise HTTPException(status_code=404, detail="Storage not found")
    return db_storage


@router.delete("/locations/{location_id}", response_model=schemas.Location)
def delete_location(location_id: int, db: Session = Depends(get_db)):
    db_location = crud.delete_location(location_id, db)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location


# Select
@router.get("/libraries", response_model=List[schemas.Library])
def read_libraries(db: Session = Depends(get_db)):
    return crud.get_libraries(db)


@router.get("/storages", response_model=List[schemas.Storage])
def read_storages(db: Session = Depends(get_db)):
    return crud.get_storages(db)


@router.get("/locations", response_model=List[schemas.Location])
def read_locations(db: Session = Depends(get_db)):
    return crud.get_locations(db)
