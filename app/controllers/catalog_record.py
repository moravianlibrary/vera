from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission
from repositories.catalog_record import CatalogRecordRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.catalog_record import (
    CatalogRecordDetails,
    CatalogRecordHit,
    CatalogRecordsSyncParams,
    MarkInReviewParams,
)
from schemas.task import Task, TaskOrSchedule, TaskScheduleParams
from services.catalog_record import CatalogRecordService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnCatalogRecordRepository,
    DependsOnCatalogRecordService,
    RestrictedTaskScheduleParams,
    WithPermission,
)

router = APIRouter(prefix="/catalog-records", tags=["Catalog records"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
    response_model=IndexerResponse[CatalogRecordHit],
)
async def search(
    request: IndexerRequest,
    repository: CatalogRecordRepository = DependsOnCatalogRecordRepository,
):
    return await repository.search(request)


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
    "/reindex",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=TaskOrSchedule,
)
async def reindex(
    query: IndexerQuery,
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.reindex(query, user.id, schedule_params)


@router.post(
    "/sync",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=TaskOrSchedule,
)
async def sync(
    query: IndexerQuery,
    sync_params: Annotated[CatalogRecordsSyncParams, Query()],
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.sync(query, sync_params, user.id, schedule_params)


@router.post(
    "/forced-validity",
    dependencies=[WithPermission(GeneralPermission.ReviewCatalogRecords)],
    response_model=Task,
)
async def set_forced_validity(
    query: IndexerQuery,
    validity: bool = True,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.set_forced_validity(query, validity, user.id)


@router.post(
    "/mark-in-review",
    dependencies=[WithPermission(GeneralPermission.ReviewCatalogRecords)],
    response_model=Task,
)
async def mark_in_review(
    query: IndexerQuery,
    review_params: Annotated[MarkInReviewParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.mark_in_review(query, review_params, user.id)


@router.post(
    "/archive-inactive",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=TaskOrSchedule,
)
async def archive_inactive(
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.archive_inactive(user.id, schedule_params)


@router.post(
    "/delete",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=Task,
)
async def delete(
    query: IndexerQuery,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CatalogRecordService = DependsOnCatalogRecordService,
):
    return await service.delete(query, user.id)
