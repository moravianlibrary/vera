from fastapi import APIRouter, Query
from pymarc import List
from starlette.responses import FileResponse

from adapters.indexer import IndexerQuery, IndexerResponse
from definitions.document import (
    DEFAULT_EXPORT_FIELDS,
    DEFAULT_EXPORT_FILENAME,
    ExportFormat,
)
from definitions.permission import OwnershipPermission
from repositories import DocumentRepository
from services.document import DocumentService

from ._resources import (
    DependsOnDocumentRepository,
    DependsOnDocumentService,
    RestrictedQuery,
)
from ._security import WithPermission

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadDocuments)],
    response_model=IndexerResponse,
)
def search(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadDocuments),
    repository: DocumentRepository = DependsOnDocumentRepository,
):
    return repository.search(query)


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


@router.put(
    "/update_property",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
)
def update_property(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    property_name: str = Query(...),
    property_value: str | None = Query(None),
    service: DocumentService = DependsOnDocumentService,
):
    return service.update_property(query, property_name, property_value)


@router.post(
    "/delete",
    dependencies=[WithPermission(OwnershipPermission.ManageDocuments)],
)
def delete(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageDocuments),
    service: DocumentService = DependsOnDocumentService,
):
    return service.delete(query)


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
