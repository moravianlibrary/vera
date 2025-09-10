from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query
from starlette.responses import FileResponse

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.watchlist import WatchlistTarget
from repositories.document_iteration import DocumentIterationRepository
from repositories.watchlist import WatchlistRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.document import (
    DocumentExportParams,
    DocumentGenerateListParams,
    DocumentsSyncParams,
    UpdatePageCountResponse,
)
from schemas.task import Task, TaskScheduleParams
from schemas.watchlist import Watchlist, WatchlistPropertiesParams
from services.document import DocumentService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnDocumentIterationRepository,
    DependsOnDocumentService,
    DependsOnWatchlistRepository,
    RestrictedQuery,
    RestrictedSearch,
    RestrictedTaskScheduleParams,
    WithGlobalPermission,
    WithPermission,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=IndexerResponse,
)
async def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadDocuments
    ),
    repository: DocumentIterationRepository = (
        DependsOnDocumentIterationRepository
    ),
):
    return await repository.search(request)


@router.post(
    "/export",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_class=FileResponse,
)
async def export(
    background_tasks: BackgroundTasks,
    export_params: Annotated[DocumentExportParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    service: DocumentService = DependsOnDocumentService,
):
    return await service.export(query, export_params, background_tasks)


@router.post(
    "/generate-list",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=Task,
)
async def generate_list(
    generate_list_params: Annotated[DocumentGenerateListParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.generate_list(query, generate_list_params, user.id)


@router.patch(
    "/{document_id}/page-count",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=UpdatePageCountResponse,
)
async def update_page_count(
    document_id: int = Path(...),
    page_count: int = Query(..., ge=1, le=10000),
    service: DocumentService = DependsOnDocumentService,
):
    return await service.update_page_count(document_id, page_count)


@router.post(
    "/category",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageDocuments,
            OwnershipPermission.ReadCategories,
            require_all=True,
        )
    ],
    response_model=Task,
)
async def set_category(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    category_id: int = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.set_category(query, category_id, user.id)


@router.post(
    "/priority",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
async def set_priority(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    priority: int = Query(..., ge=1, le=5),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.set_priority(query, priority, user.id)


@router.post(
    "/digitization-decision",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
async def set_digitization_decision(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    decline: bool = Query(
        ...,
        description="Set to true to decline digitization, "
        "false to cancel previous declination",
    ),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.set_digitization_decision(query, decline, user.id)


@router.post(
    "/reindex",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
async def reindex(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.reindex(query, user.id, schedule_params)


@router.post(
    "/sync",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
async def sync(
    sync_params: Annotated[DocumentsSyncParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.sync(query, sync_params, user.id, schedule_params)


@router.post(
    "/delete",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
async def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return await service.delete(query, user.id)


@router.post(
    "/watchlist",
    dependencies=[
        WithPermission(GeneralPermission.ManageWatchlists),
        WithGlobalPermission(OwnershipPermission.ReadDocuments),
    ],
    response_model=Watchlist,
)
async def create_watchlist(
    query: IndexerQuery,
    params: Annotated[WatchlistPropertiesParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return await repository.create(params, WatchlistTarget.Documents, query)


# TODO: Implement in some future release
# @router.post(
#     "/documents/{document_id}/comments",
#     dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
# )
# def create_comment(
#     # comment: CommentCreate,
#     # document_id: int = Path(...),
#     # service:
# ):
#     pass


# @router.put(
#     "/documents/{document_id}/comments/{comment_id}",
#     dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
#     response_model=Comment,
# )
# def update_comment(
#     comment: Comment,
#     document_id: int = Path(...),
#     user: CurrentUser = Depends(get_current_user),
#     db: Session = Depends(get_session),
# ):
#     pass


# @router.delete(
#     "/documents/{document_id}/comments/{comment_id}",
#     response_model=Comment,
# )
# def delete_comment(
#     document_id: int = Path(...),
#     comment_id: int = Path(...),
#     user: CurrentUser = Depends(get_current_user),
#     db: Session = Depends(get_session),
# ):
#     return crud.delete_comment(comment_id, db)
#     return crud.delete_comment(comment_id, db)
