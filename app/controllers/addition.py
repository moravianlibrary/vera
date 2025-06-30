from typing import Annotated, List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import AdditionRepository
from schemas.addition import (
    Addition,
    AdditionBatchParams,
    AdditionCreate,
    IngestAdditionsParams,
    IngestAdditionsResponse,
)
from schemas.task import Task
from schemas.user import AuthenticatedUser
from services import AdditionService

from .resources import (
    DependsOnAdditionRepository,
    DependsOnAdditionService,
    DependsOnAuthenticatedUser,
    RestrictedParams,
    RestrictedQuery,
    WithPermission,
)

router = APIRouter(prefix="/additions", tags=["Additions"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadAdditions)],
    response_model=IndexerResponse[Addition],
)
def search(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadAdditions),
    repository: AdditionRepository = DependsOnAdditionRepository,
):
    return repository.search(query)


@router.post(
    "/ingest",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=IngestAdditionsResponse,
)
def ingest(
    additions: List[AdditionCreate],
    batch_params: Annotated[AdditionBatchParams, Query()],
    ingest_params: Annotated[IngestAdditionsParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.ingest(additions, batch_params, ingest_params, user.id)


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageAdditions)],
    response_model=Task,
)
def reingest(
    ingest_params: IngestAdditionsParams = RestrictedParams(
        GeneralPermission.IgnoreAdditionChecks, IngestAdditionsParams
    ),
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.reingest(query, ingest_params, user.id)


@router.post(
    "/archive",
    dependencies=[WithPermission(OwnershipPermission.ManageAdditions)],
    response_model=Task,
)
def archive(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.archive(query, user.id)


@router.post(
    "/delete",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageAdditions,
            GeneralPermission.DeleteAdditions,
        )
    ],
    response_model=Task,
)
def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.delete(query, user.id)
