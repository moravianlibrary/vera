from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional
from .utils.dependencies import DependsOnDbSession
from .utils.permissions import CanReadIntentions, CanManageIntentions
from models import Distribution, Intention
from schemas import IntentionCreate, IntentionResponse
from typing import List

router = APIRouter(prefix="/intentions", tags=["Intentions"])


@router.post(
    "",
    dependencies=[CanManageIntentions],
    response_model=IntentionResponse,
)
def create_intention(
    intention: IntentionCreate,
    copy_distribution_from: Optional[int] = Query(
        None, alias="copyDistributionFrom"
    ),
    session: Session = DependsOnDbSession,
):
    if copy_distribution_from is None:
        return Intention.create(intention, session)
    copy_from_intention = Intention.get(copy_distribution_from, session)
    intention = Intention.create(intention, session)
    Distribution.copy_distributions(
        copy_from_intention.id, intention.id, session
    )
    return intention


@router.put(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=IntentionResponse,
)
def update_intention(
    intention: IntentionCreate,
    intention_id: int = Path(...),
    copy_distribution_from: Optional[int] = Query(
        None, alias="copyDistributionFrom"
    ),
    session: Session = DependsOnDbSession,
):
    if intention.end_date < intention.start_date:
        date = intention.end_date
        intention.end_date = intention.start_date
        intention.start_date = date

    if copy_distribution_from is None:
        return Intention.update(intention_id, intention, session)

    copy_from_intention = Intention.get(copy_distribution_from, session)
    intention = Intention.update(intention_id, intention, session)
    Distribution.copy_distributions(
        copy_from_intention.id, intention.id, session
    )
    return intention


@router.delete(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=IntentionResponse,
)
def delete_intention(
    intention_id: int = Path(...), session: Session = DependsOnDbSession
):
    return Intention.get(session, intention_id).delete(session)


@router.get(
    "",
    dependencies=[CanReadIntentions],
    response_model=List[IntentionResponse],
)
def get_intentions(
    session: Session = DependsOnDbSession,
):
    return Intention.all(session)


@router.get(
    "/{intention_id}",
    dependencies=[CanReadIntentions],
    response_model=IntentionResponse,
)
def get_intention(
    intention_id: int = Path(...),
    session: Session = DependsOnDbSession,
):
    return Intention.get(session, intention_id)
