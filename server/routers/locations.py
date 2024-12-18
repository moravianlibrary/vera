from fastapi import APIRouter
from sqlalchemy.orm import Session
from .utils.permissions import CanManageLocations, CanExtract
from .utils.dependencies import DependsOnDbSession, DependsOnEsSession
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
    IndexLocation.model_validate(
        location.load_to_model(Location()).save(db_session)
    ).save(es_session)
    # TODO: return message


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
    IndexLocation.model_validate(
        location.load_to_model(Location.get(session, location_id)).save(
            session
        )
    ).save(es_session)
    # TODO: return message


@router.delete(
    "/{location_id}",
    dependencies=[CanManageLocations],
)
def delete(
    location_id: int,
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    Location.get(session, location_id).delete()
    IndexLocation.delete(es_session, location_id)
    # TODO: return message


@router.get("/search", dependencies=[CanExtract])
def get_locations(
    query_params: ElasticsearchParams,
    es_session: EsSession = DependsOnEsSession,
):
    return IndexLocation.search(es_session, query_params)
