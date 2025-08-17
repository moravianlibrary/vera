from typing import Annotated, List, Optional

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.digitization_registry import DigitizationState
from definitions.permission import GeneralPermission
from repositories.digitization_list import DigiListRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.digitization_list import (
    CreateDigitizationListParams,
    DigitizationList,
    DigitizationListHit,
)
from schemas.task import Task
from services.digitization_list import DigiListService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnDigiListRepository,
    DependsOnDigiListService,
    WithPermission,
)

router = APIRouter(prefix="/digitization-lists", tags=["Digitization lists"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadDigitizationLists)],
    response_model=IndexerResponse[DigitizationListHit],
)
async def search(
    request: IndexerRequest,
    repository: DigiListRepository = DependsOnDigiListRepository,
):
    return await repository.search(request)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateDigitizationLists)],
    response_model=Task,
)
async def create(
    query: IndexerQuery,
    create_params: Annotated[CreateDigitizationListParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DigiListService = DependsOnDigiListService,
):
    return await service.create(query, create_params, user.id)


@router.post(
    "/{digitization_list_id}/state",
    dependencies=[WithPermission(GeneralPermission.CreateDigitizationLists)],
    response_model=Task,
)
async def change_state(
    digitization_list_id: int = Path(...),
    state: Optional[DigitizationState] = Query(None),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DigiListService = DependsOnDigiListService,
):
    return await service.change_state(
        digitization_list_id, state, user.id, user.general_permissions
    )


@router.patch(
    "/{digitization_list_id}/intentions",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationList,
)
async def change_intentions(
    digitization_list_id: int = Path(...),
    intention_ids: Optional[List[int]] = Query(default=[]),
    service: DigiListService = DependsOnDigiListService,
):
    return await service.change_intentions(digitization_list_id, intention_ids)


@router.post(
    "/{digitization_list_id}/add-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
async def add_documents(
    query: IndexerQuery,
    digitization_list_id: int = Path(...),
    skip_state_validation_for: List[DigitizationState] = Query([]),
    service: DigiListService = DependsOnDigiListService,
):
    return await service.add_documents(
        digitization_list_id, query, skip_state_validation_for
    )


@router.post(
    "/{digitization_list_id}/remove-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
async def remove_documents(
    query: IndexerQuery,
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return await service.remove_documents(digitization_list_id, query)


@router.post(
    "/{digitization_list_id}/delete",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
async def delete(
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return await service.delete(digitization_list_id)
