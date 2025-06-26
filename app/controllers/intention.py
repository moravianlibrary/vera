from fastapi import APIRouter, Path

from adapters.indexer import IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission
from repositories import IntentionRepository
from schemas.intention import Intention, IntentionEdit
from services.intention import IntentionService

from .resources import (
    DependsOnIntentionRepository,
    DependsOnIntentionService,
    WithPermission,
)

router = APIRouter(prefix="/intentions", tags=["Intentions"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadIntentions)],
    response_model=IndexerResponse[Intention],
)
def search(
    request: IndexerRequest,
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    return repository.search(request)


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
    service: IntentionService = DependsOnIntentionService,
):
    return service.update(repository.get_by_id(intention_id), intention)


@router.delete(
    "/{intention_id}",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
def delete(
    intention_id: int = Path(...),
    repository: IntentionRepository = DependsOnIntentionRepository,
    service: IntentionService = DependsOnIntentionService,
):
    return service.delete(repository.get_by_id(intention_id))
