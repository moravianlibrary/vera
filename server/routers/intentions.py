from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from .utils.dependencies import DependsOnDbSession, DependsOnEsSession
from .utils.permissions import CanReadIntentions, CanManageIntentions
from models import Intention, IntentionCategory
from schemas import IntentionCreate, IntentionResponse, IndexIntention
from datatypes import ElasticsearchParams
from schemas import EsSession

router = APIRouter(prefix="/intentions", tags=["Intentions"])


@router.post(
    "",
    dependencies=[CanManageIntentions],
)
def create_intention(
    intention: IntentionCreate,
    session: Session = DependsOnDbSession,
):
    db_intention = Intention(
        name=intention.name,
        description=intention.description,
        target_page_count=intention.target_page_count,
        start_date=intention.start_date,
        end_date=intention.end_date,
    ).save(session)

    for category_id in intention.associated_categories:
        IntentionCategory(
            intention_id=db_intention.id, category_id=category_id
        ).save(session)

    session.refresh(db_intention)

    IndexIntention.model_validate(db_intention).save()

    # TODO: return response
    return


@router.put(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=IntentionResponse,
)
def update_intention(
    intention: IntentionCreate,
    intention_id: int = Path(...),
    session: Session = DependsOnDbSession,
):
    db_intention = Intention.get(session, intention_id)

    db_intention.name = intention.name
    db_intention.description = intention.description
    db_intention.target_page_count = intention.target_page_count
    db_intention.start_date = intention.start_date
    db_intention.end_date = intention.end_date

    db_intention.save(session)

    old_categories = {
        category.category_id for category in db_intention.associated_categories
    }
    new_categories = set(intention.associated_categories)

    for category_id in old_categories - new_categories:
        IntentionCategory.get(session, (intention_id, category_id)).delete(
            session
        )

    for category_id in new_categories - old_categories:
        IntentionCategory(
            intention_id=intention_id,
            category_id=category_id,
        ).save(session)

    # TODO: update other fields


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
    "/search",
    dependencies=[CanReadIntentions],
)
def get_intentions(
    query_params: ElasticsearchParams,
    es_session: EsSession = DependsOnEsSession,
):
    return IndexIntention.search(es_session, query_params)
