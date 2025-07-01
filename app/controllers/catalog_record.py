from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission
from repositories.catalog_record import CatalogRecordRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.catalog_record import (
    CatalogRecord,
    CatalogRecordDetails,
    CatalogRecordsSyncParams,
)
from schemas.task import Task, TaskScheduleParams
from services.catalog_record import CatalogRecordService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnCatalogRecordRepository,
    DependsOnCatalogRecordService,
    ResolveTaskScheduleParams,
    WithPermission,
)

router = APIRouter(prefix="/catalog-records", tags=["Catalog records"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
    response_model=IndexerResponse[CatalogRecord],
)
def search(
    request: IndexerRequest,
    repository: CatalogRecordRepository = DependsOnCatalogRecordRepository,
):
    return repository.search(request)


@router.get(
    "/{record_id}/details",
    dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
    response_model=CatalogRecordDetails,
)
def get_details(
    record_id: str = Path(...),
    repository: CatalogRecordRepository = DependsOnCatalogRecordRepository,
):
    return repository.get_by_id(record_id)


@router.post(
    "/change-validity",
    dependencies=[WithPermission(GeneralPermission.ReviewCatalogRecords)],
    response_model=Task,
)
def change_validity(
    query: IndexerQuery,
    is_valid: bool = True,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.set_validity(query, is_valid, user.id)


@router.post(
    "/reindex",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=Task,
)
def reindex(
    query: IndexerQuery,
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.reindex(query, user.id, schedule_params)


@router.post(
    "/sync",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=Task,
)
def sync(
    query: IndexerQuery,
    sync_params: Annotated[CatalogRecordsSyncParams, Query()],
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.sync(query, sync_params, user.id, schedule_params)


@router.post(
    "/archive-inactive",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=Task,
)
def archive_inactive(
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.archive_inactive(user.id, schedule_params)


@router.post(
    "/delete",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=Task,
)
def delete(
    query: IndexerQuery,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.delete(query, user.id)
