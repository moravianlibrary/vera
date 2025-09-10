from fastapi import APIRouter, Path

from adapters.indexer import IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission
from repositories import IntentionRepository
from schemas.intention import Intention, IntentionEdit, IntentionHit
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
    response_model=IndexerResponse,
)
async def search(
    request: IndexerRequest,
    repository: IntentionRepository = DependsOnIntentionRepository,
):
    return await repository.search(request)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
async def create(
    intention: IntentionEdit,
    service: IntentionService = DependsOnIntentionService,
):
    return await service.create(intention)


@router.put(
    "/{intention_id}",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
async def update(
    intention_edit: IntentionEdit,
    intention_id: int = Path(...),
    service: IntentionService = DependsOnIntentionService,
):
    return await service.update(intention_id, intention_edit)


@router.delete(
    "/{intention_id}",
    dependencies=[WithPermission(GeneralPermission.ManageIntentions)],
    response_model=Intention,
)
async def delete(
    intention_id: int = Path(...),
    service: IntentionService = DependsOnIntentionService,
):
    return await service.delete(intention_id)
