from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from security.permissions import PermissionValidator
from security.types import ActionType
from services.database import get_db

from categories.intentions.models import Intention
from categories.intentions import schemas


router = APIRouter(prefix="/categories/intentions")

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
    db: Session = Depends(get_db),
):
    return Intention.create(intention, db)


@router.put(
    "/{intention_id}",
    dependencies=[CanManageIntentions],
    response_model=schemas.Intention,
)
def update_intention(
    intention: schemas.IntentionCreate,
    intention_id: int = Path(...),
    db: Session = Depends(get_db),
):
    if intention.end_date < intention.start_date:
        date = intention.end_date
        intention.end_date = intention.start_date
        intention.start_date = date
    return Intention.update(intention_id, intention, db)


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
