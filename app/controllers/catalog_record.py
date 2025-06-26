from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission
from repositories.catalog_record import CatalogRecordRepository
from schemas.catalog_records import (
    CatalogRecord,
    CatalogRecordDetails,
    CatalogRecordsSyncParams,
)
from schemas.task import Task, TaskScheduleParams
from schemas.user import AuthenticatedUser
from schemas.watchlist import Watchlist, WatchlistParams
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
    return service.set_validity(query, is_valid, user.user_id)


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
    return service.reindex(query, user.user_id, schedule_params)


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
    return service.sync(query, sync_params, user.user_id, schedule_params)


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
    return service.archive_inactive(user.user_id, schedule_params)


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
    return service.delete(query, user.user_id)


@router.post(
    "/watchlist",
    dependencies=[
        WithPermission(
            GeneralPermission.ReadCatalogRecords,
            GeneralPermission.ManageWatchlists,
        )
    ],
    response_model=Watchlist,
)
def create_watchlist(
    query: IndexerQuery,
    list_params: Annotated[WatchlistParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return service.create_watchlist(query, list_params, user.user_id)
