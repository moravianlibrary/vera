from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from routers.utils.permissions import PermissionValidator
from schemas.types.action_type import ActionType
from services.database import get_db

from categories.categories.models import Distribution
from categories.intentions.models import Intention
from categories.intentions import schemas


router = APIRouter(prefix="/intentions")

CanManageIntentions = PermissionValidator(ActionType.EditCategoriesAll)
CanReadIntentions = PermissionValidator(
    [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
)


@router.post(
    "",
    dependencies=[CanManageIntentions],
    response_model=schemas.Intention,
)
def create_intention(
    intention: schemas.IntentionCreate,
    copy_distribution_from: Optional[int] = Query(
        None, alias="copyDistributionFrom"
    ),
    db: Session = Depends(get_db),
):
    if copy_distribution_from is None:
        return Intention.create(intention, db)
    copy_from_intention = Intention.get(copy_distribution_from, db)
    intention = Intention.create(intention, db)
    Distribution.copy_distributions(copy_from_intention.id, intention.id, db)
    return intention


@router.put(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=schemas.Intention,
)
def update_intention(
    intention: schemas.IntentionCreate,
    intention_id: int = Path(...),
    copy_distribution_from: Optional[int] = Query(
        None, alias="copyDistributionFrom"
    ),
    db: Session = Depends(get_db),
):
    if intention.end_date < intention.start_date:
        date = intention.end_date
        intention.end_date = intention.start_date
        intention.start_date = date

    if copy_distribution_from is None:
        return Intention.update(intention_id, intention, db)

    copy_from_intention = Intention.get(copy_distribution_from, db)
    intention = Intention.update(intention_id, intention, db)
    Distribution.copy_distributions(copy_from_intention.id, intention.id, db)
    return intention


@router.delete(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=schemas.Intention,
)
def delete_intention(
    intention_id: int = Path(...), db: Session = Depends(get_db)
):
    return Intention.delete(intention_id, db)


@router.get(
    "",
    dependencies=[CanReadIntentions],
    response_model=schemas.Intentions,
)
def get_intentions(
    db: Session = Depends(get_db),
):
    return Intention.get_all(db)


@router.get(
    "/{intention_id}",
    dependencies=[CanReadIntentions],
    response_model=schemas.Intentions,
)
def get_intention(
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return Intention.get(intention_id, db)
