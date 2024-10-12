from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from .utils.permissions import CanManageLocations
from .utils.dependencies import DependsOnDbSession
from schemas import (
    LibraryCreate,
    LibraryResponse,
    StorageCreate,
    StorageResponse,
    LocationCreate,
    LocationResponse,
    Page,
)
from models import Library, Storage, Location

router = APIRouter(prefix="/locations", tags=["Locations"])


# create
@router.post(
    "/libraries",
    dependencies=[CanManageLocations],
    response_model=LibraryResponse,
)
def create_library(
    library: LibraryCreate, session: Session = DependsOnDbSession
):
    return library.load_to_model(Library()).save(session)


@router.post(
    "/storages",
    dependencies=[CanManageLocations],
    response_model=StorageResponse,
)
def create_storage_for_library(
    storage: StorageCreate,
    session: Session = DependsOnDbSession,
):
    return storage.load_to_model(Storage()).save(session)


@router.post(
    "/locations",
    dependencies=[CanManageLocations],
    response_model=LocationResponse,
)
def create_location_for_storage(
    location: LocationCreate,
    session: Session = DependsOnDbSession,
):
    return location.load_to_model(Location()).save(session)


# Update
@router.put(
    "/libraries/{library_id}",
    dependencies=[CanManageLocations],
    response_model=LibraryResponse,
)
def update_library(
    library_id: str,
    library: LibraryCreate,
    session: Session = DependsOnDbSession,
):
    return library.load_to_model(Library.get(session, library_id)).save(
        session
    )


@router.put(
    "/storages/{storage_id}",
    dependencies=[CanManageLocations],
    response_model=StorageResponse,
)
def update_storage(
    storage_id: int,
    storage: StorageCreate,
    session: Session = DependsOnDbSession,
):
    return storage.load_to_model(Storage.get(session, storage_id)).save(
        session
    )


@router.put(
    "/locations/{location_id}",
    dependencies=[CanManageLocations],
    response_model=LocationResponse,
)
def update_location(
    location_id: int,
    location: LocationCreate,
    session: Session = DependsOnDbSession,
):
    return location.load_to_model(Location.get(session, location_id)).save(
        session
    )


# Delete
@router.delete(
    "/libraries/{library_id}",
    dependencies=[CanManageLocations],
    response_model=LibraryResponse,
)
def delete_library(library_id: str, session: Session = DependsOnDbSession):
    return Library.get(session, library_id).delete()


@router.delete(
    "/storages/{storage_id}",
    dependencies=[CanManageLocations],
    response_model=StorageResponse,
)
def delete_storage(storage_id: int, session: Session = DependsOnDbSession):
    return Storage.get(session, storage_id).delete()


@router.delete(
    "/locations/{location_id}",
    dependencies=[CanManageLocations],
    response_model=LocationResponse,
)
def delete_location(location_id: int, session: Session = DependsOnDbSession):
    return Location.get(session, location_id).delete()


# Select
@router.get("/libraries", response_model=Page[LibraryResponse])
def get_libraries(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return Library.get_page(session, page, page_size)


@router.get("/storages", response_model=Page[StorageResponse])
def get_storages(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return Storage.get_page(session, page, page_size)


@router.get("/locations", response_model=Page[LocationResponse])
def get_locations(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return Location.get_page(session, page, page_size)
