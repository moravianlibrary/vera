from typing import List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerResponse
from definitions.addition import DocumentAdditionUpdateType
from definitions.permission import GeneralPermission
from repositories import AdditionRepository
from schemas.addition import (
    AdditionCreate,
    DeleteAdditionResponse,
    EnqueueAdditionResponse,
    UpdateAdditionResponse,
)
from services import AdditionService

from ._resources import (
    DependsOnAdditionRepository,
    DependsOnAdditionService,
    UserRestrictedQuery,
)
from ._security import WithPermission

router = APIRouter(prefix="/additions", tags=["Additions"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=IndexerResponse,
)
def search(
    query: IndexerQuery,
    repository: AdditionRepository = DependsOnAdditionRepository,
):
    return repository.search(query)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=EnqueueAdditionResponse,
)
def create(
    additions: List[AdditionCreate],
    service: AdditionService = DependsOnAdditionService,
):
    return service.create(additions)


@router.put(
    "",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=UpdateAdditionResponse,
)
def update(
    query: IndexerQuery = UserRestrictedQuery(),
    update_type: DocumentAdditionUpdateType = Query(...),
    service: AdditionService = DependsOnAdditionService,
):
    return service.update(query, update_type)


@router.delete(
    "",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=DeleteAdditionResponse,
)
def delete(
    query: IndexerQuery = UserRestrictedQuery(),
    service: AdditionService = DependsOnAdditionService,
):
    return service.delete(query)
