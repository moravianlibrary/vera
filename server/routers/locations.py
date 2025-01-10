from fastapi import APIRouter
from sqlalchemy.orm import Session
from .utils.permissions import CanManageLocations, CanExtract
from .utils.dependencies import DependsOnDbSession, DependsOnEsSession
from .utils.responses import CreateResponse, UpdateResponse, DeleteResponse
from schemas import LocationCreate, IndexLocation
from models import Location
from datatypes import ElasticsearchParams
from schemas import EsSession

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post(
    "",
    dependencies=[CanManageLocations],
)
def create(
    location: LocationCreate,
    db_session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    db_location = Location(
        name=location.name,
        regexp=location.regexp,
        description=location.description,
        included_in=location.included_in,
    ).save(db_session)

    IndexLocation.model_validate(db_location).save(es_session, True)

    return CreateResponse(f"Location {location.name}")


@router.put(
    "/{location_id}",
    dependencies=[CanManageLocations],
)
def update(
    location_id: int,
    location: LocationCreate,
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    db_location = Location.get(session, location_id)

    db_location.name = location.name
    db_location.regexp = location.regexp
    db_location.description = location.description
    db_location.included_in = location.included_in

    db_location.save(session)

    IndexLocation.model_validate(db_location).save(es_session, True)

    return UpdateResponse(f"Location {location.name}")


@router.delete(
    "/{location_id}",
    dependencies=[CanManageLocations],
)
def delete(
    location_id: int,
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    db_location = Location.get(session, location_id).delete(session)
    IndexLocation.delete(es_session, location_id, True)
    return DeleteResponse(f"Location {db_location.name}")


@router.get("/search", dependencies=[CanExtract])
def get_locations(
    query_params: ElasticsearchParams,
    es_session: EsSession = DependsOnEsSession,
):
    return IndexLocation.search(es_session, query_params)
