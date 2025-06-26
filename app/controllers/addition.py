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
)
from schemas.task import Task
from schemas.user import AuthenticatedUser
from services import AdditionService

from ._resources import (
    DependsOnAdditionRepository,
    DependsOnAdditionService,
    RestrictedQuery,
)
from ._security import (
    DependsOnAuthenticatedUser,
    WithPermission,
    WithRestrictedParams,
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
    response_model=Task,
)
def ingest(
    additions: List[AdditionCreate],
    batch_params: Annotated[AdditionBatchParams, Query()],
    ingest_params: Annotated[IngestAdditionsParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.ingest(additions, batch_params, ingest_params, user.user_id)


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageAdditions)],
    response_model=Task,
)
def reingest(
    ingest_params: IngestAdditionsParams = WithRestrictedParams(
        GeneralPermission.IgnoreAdditionChecks, IngestAdditionsParams
    ),
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.reingest(query, ingest_params, user.user_id)


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
    return service.archive(query, user.user_id)


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
    return service.delete(query, user.user_id)
