from typing import List, Optional

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerResponse
from controllers._resources import (
    DependsOnDigiListRepository,
    DependsOnDigiListService,
)
from custom_types import GeneralPermission
from datatypes import DigitizationState, EsRoutingParams
from repositories.digitization_list import DigiListRepository
from schemas.message_response import TaskMessageResponse
from schemas.user import AuthenticatedUser
from services.digitization_list import DigiListService

from ._security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/digitization-lists", tags=["Digitization lists"])


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadDigitizationLists)],
    response_model=IndexerResponse,
)
def search(
    query: IndexerQuery,
    repository: DigiListRepository = DependsOnDigiListRepository,
):
    return repository.search(query)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateDigitizationLists)],
    response_model=TaskMessageResponse,
)
def create(
    query_routing_params: EsRoutingParams,
    intention_ids: List[int] = Query(default=[]),
    ignore_digitization_states: List[DigitizationState] = Query(default=[]),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DigiListService = DependsOnDigiListService,
):
    return service.create(
        query_routing_params,
        intention_ids,
        ignore_digitization_states,
        user.user_id,
    )


@router.put(
    "/{digitization_list_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=TaskMessageResponse,
)
def update(
    digitization_list_id: int = Path(...),
    intention_ids: Optional[List[int]] = Query(default=None),
    service: DigiListService = DependsOnDigiListService,
):
    return service.update(digitization_list_id, intention_ids)


@router.put(
    "/{digitization_list_id}/add-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=TaskMessageResponse,
)
def add_documents(
    query_routing_params: EsRoutingParams,
    digitization_list_id: int = Path(...),
    ignore_digitization_states: List[DigitizationState] = Query([]),
    service: DigiListService = DependsOnDigiListService,
):
    return service.add_documents(
        query_routing_params,
        digitization_list_id,
        ignore_digitization_states,
    )


@router.put(
    "/{digitization_list_id}/remove-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=TaskMessageResponse,
)
def remove_documents(
    query_routing_params: EsRoutingParams,
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return service.remove_documents(query_routing_params, digitization_list_id)


@router.delete(
    "/{digitization_list_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=TaskMessageResponse,
)
def delete(
    digitization_list_id: int = Path(...),
    service: DigiListService = DependsOnDigiListService,
):
    return service.delete(digitization_list_id)
