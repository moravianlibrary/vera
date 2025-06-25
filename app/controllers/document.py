from typing import Annotated, List, Optional

from fastapi import APIRouter, Path, Query
from starlette.responses import FileResponse

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.document import (
    DEFAULT_EXPORT_FIELDS,
    DEFAULT_EXPORT_FILENAME,
    ExportFormat,
    Priority,
)
from definitions.permission import OwnershipPermission
from repositories import DocumentRepository
from schemas.document import Document, DocumentsSyncParams
from schemas.task import Task, TaskScheduleParams
from schemas.user import AuthenticatedUser
from services.document import DocumentService

from ._resources import (
    DependsOnAuthenticatedUser,
    DependsOnDocumentRepository,
    DependsOnDocumentService,
    RestrictedQuery,
    RestrictedSearchRequest,
)
from ._security import ResolveTaskScheduleParams, WithPermission

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=IndexerResponse[Document],
)
def search(
    request: IndexerRequest = RestrictedSearchRequest(
        OwnershipPermission.ReadDocuments
    ),
    repository: DocumentRepository = DependsOnDocumentRepository,
):
    return repository.search(request)


@router.post(
    "/export",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=FileResponse,
)
def export(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    fields: List[str] = Query(default=DEFAULT_EXPORT_FIELDS),
    filename: str = Query(DEFAULT_EXPORT_FILENAME),
    export_format: ExportFormat = Query(ExportFormat.xlsx),
    service: DocumentService = DependsOnDocumentService,
):
    return service.export(query, fields, filename, export_format)


@router.patch(
    "/{document_id}/update-page-count",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Document,
)
def update_page_count(
    document_id: int = Path(...),
    page_count: Optional[int] = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.update_page_count(document_id, page_count, user.user_id)


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
def change_category(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    category_id: int = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.set_category(query, category_id, user.user_id)


@router.post(
    "/priority",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def change_priority(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    priority: Priority = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.set_priority(query, priority, user.user_id)


@router.post(
    "/decline-digitization",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def change_decline_digitization(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    decline: bool = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.change_decline_digitization(query, decline, user.user_id)


# TODO: maybe add update-property


@router.post(
    "/reindex",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def reindex(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.reindex(query, user.user_id, schedule_params)


@router.post(
    "/sync",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def sync(
    sync_params: Annotated[DocumentsSyncParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.sync(query, sync_params, user.user_id, schedule_params)


@router.post(
    "/delete",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.delete(query, user.user_id)


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
