from typing import Annotated, List

from fastapi import APIRouter, Query

from adapters.indexer import IndexerQuery, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import AdditionRepository
from schemas.addition import (
    AdditionCreate,
    AdditionHit,
    AdditionsSettingsParams,
    IngestAdditionsParams,
    IngestAdditionsResponse,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.task import Task
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
    response_model=IndexerResponse[AdditionHit],
)
async def search(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadAdditions),
    repository: AdditionRepository = DependsOnAdditionRepository,
):
    return await repository.search(query)


@router.post(
    "/ingest",
    dependencies=[WithPermission(GeneralPermission.AddDocuments)],
    response_model=IngestAdditionsResponse,
)
async def ingest(
    additions: List[AdditionCreate],
    params: Annotated[IngestAdditionsParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return await service.ingest(
        additions, params.batch, params.settings, user.id
    )


@router.post(
    "/reingest",
    dependencies=[WithPermission(OwnershipPermission.ManageAdditions)],
    response_model=Task,
)
async def reingest(
    ingest_params: AdditionsSettingsParams = RestrictedParams(
        GeneralPermission.IgnoreAdditionChecks, AdditionsSettingsParams
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
async def archive(
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
async def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageAdditions),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: AdditionService = DependsOnAdditionService,
):
    return service.delete(query, user.id)
