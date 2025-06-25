from typing import List, Optional

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.digitization_registry import DigitizationState
from definitions.permission import GeneralPermission
from repositories.digitization_list import DigiListRepository
from schemas.digitization_list import DigitizationList
from schemas.task import Task
from schemas.user import AuthenticatedUser
from services.digitization_list import DigiListService

from ._resources import DependsOnDigiListRepository, DependsOnDigiListService
from ._security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/digitization-lists", tags=["Digitization lists"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadDigitizationLists)],
    response_model=IndexerResponse[DigitizationList],
)
def search(
    request: IndexerRequest,
    repository: DigiListRepository = DependsOnDigiListRepository,
):
    return repository.search(request)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateDigitizationLists)],
    response_model=Task,
)
def create(
    query: IndexerQuery,
    intention_ids: List[int] = Query(default=[]),
    include_digitization_states: List[DigitizationState] = Query(default=[]),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DigiListService = DependsOnDigiListService,
):
    return service.create(
        query, intention_ids, include_digitization_states, user.user_id
    )


@router.patch(
    "/{digitization_list_id}/change-intentions",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationList,
)
def change_intentions(
    digitization_list_id: int = Path(...),
    intention_ids: Optional[List[int]] = Query(default=[]),
    service: DigiListService = DependsOnDigiListService,
):
    return service.change_intentions(digitization_list_id, intention_ids)


@router.post(
    "/{digitization_list_id}/add-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
def add_documents(
    query: IndexerQuery,
    digitization_list_id: int = Path(...),
    include_digitization_states: List[DigitizationState] = Query([]),
    service: DigiListService = DependsOnDigiListService,
):
    return service.add_documents(
        query, digitization_list_id, include_digitization_states
    )


@router.post(
    "/{digitization_list_id}/remove-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
def remove_documents(
    query: IndexerQuery,
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return service.remove_documents(query, digitization_list_id)


@router.post(
    "/{digitization_list_id}/delete",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=Task,
)
def delete(
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return service.delete(digitization_list_id)
