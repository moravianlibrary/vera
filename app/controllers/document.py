from typing import Annotated

from fastapi import APIRouter, Path, Query
from starlette.responses import FileResponse

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.document import Priority
from definitions.permission import OwnershipPermission
from repositories import DocumentRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.document import (
    Document,
    DocumentExportParams,
    DocumentGenerateListParams,
    DocumentsSyncParams,
)
from schemas.task import Task, TaskScheduleParams
from services.document import DocumentService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnDocumentRepository,
    DependsOnDocumentService,
    RestrictedQuery,
    RestrictedSearch,
    RestrictedTaskScheduleParams,
    WithPermission,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=IndexerResponse[Document],
)
def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadDocuments
    ),
    repository: DocumentRepository = DependsOnDocumentRepository,
):
    return repository.search(request)


@router.post(
    "/export",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_class=FileResponse,
)
def export(
    export_params: Annotated[DocumentExportParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    service: DocumentService = DependsOnDocumentService,
):
    return service.export(query, export_params)


@router.post(
    "/generate-list",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=Task,
)
def generate_list(
    generate_list_params: Annotated[DocumentGenerateListParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.generate_list(query, generate_list_params, user.id)


@router.patch(
    "/{document_id}/page-count",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Document,
)
def update_page_count(
    document_id: int = Path(...),
    page_count: int = Query(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.update_page_count(document_id, page_count, user.id)


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
    return service.set_category(query, category_id, user.id)


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
    return service.set_priority(query, priority, user.id)


@router.post(
    "/digitization-decision",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def set_digitization_decision(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    decline: bool = Query(
        ...,
        description="Set to true to decline digitization, "
        "false to cancel previous declination",
    ),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.set_digitization_decision(query, decline, user.id)


@router.post(
    "/reindex",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def reindex(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.reindex(query, user.id, schedule_params)


@router.post(
    "/sync",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
    response_model=Task,
)
def sync(
    sync_params: Annotated[DocumentsSyncParams, Query()],
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: DocumentService = DependsOnDocumentService,
):
    return service.sync(query, sync_params, user.id, schedule_params)


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
    return service.delete(query, user.id)


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
