from fastapi import APIRouter, Path

from custom_types import GeneralPermission
from repositories import IntentionRepository
from schemas import Intention, IntentionEdit

from ._resources import DependsOnIntentionRepository
from .security import WithPermission

router = APIRouter(prefix="/intentions", tags=["Intentions"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadIntentions)],
    response_model=Intention,
)
def search(
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    pass


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
def create(
    intention: IntentionEdit,
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    return repository.create(intention)


@router.put(
    "/{intention_id}",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
def update(
    intention: IntentionEdit,
    intention_id: int = Path(...),
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    return repository.update(intention_id, intention)


@router.delete(
    "/{intention_id}",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
def delete(
    intention_id: int = Path(...),
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    return repository.delete(repository.get_by_id(intention_id))
