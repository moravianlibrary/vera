from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional
from schemas import (
    CurrentUser,
    AddDocumentResponse,
    Identifier,
    DocumentResponse,
)
from datatypes import ActionType, ElasticsearchParams
from models import Document
from routers.utils.permissions import (
    CanInsertDocument,
    CanManageDocument,
    CanReadDocument,
    CanReadDocuments,
    CanManageDocuments,
    OwnershipValidator,
)
from routers.utils.dependencies import (
    DependsOnCurrentUser,
    DependsOnDbSession,
    DependsOnCallerUsername,
    DependsOnDocumentsIndexer,
)
from logic.add_document import add_document
from services.documents_indexer import DocumentsIndexer
from starlette.responses import FileResponse
import pandas as pd
import tempfile
from datetime import datetime


XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(prefix="/documents", tags=["Documents"])


def restrict_editing_query_params(
    query_params: ElasticsearchParams, user: CurrentUser
) -> ElasticsearchParams:
    if user.has_action(ActionType.EditDatatableAll):
        return query_params
    if user.has_action(ActionType.EditDatatableDepartment):
        return DocumentsIndexer.restrict_query_params_for_categories(
            query_params, user.department_categories_ids
        )
    if user.has_action(ActionType.EditDatatableOwn):
        return DocumentsIndexer.restrict_query_params_for_username(
            query_params, user.username
        )
    raise Exception("User without edit permission trying to edit documents")


@router.post(
    "/from_catalog",
    dependencies=[CanInsertDocument],
    response_model=AddDocumentResponse,
)
async def add_document_from_catalog(
    identifier: Identifier,
    category_id: int = Query(),
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
    username: str = DependsOnCallerUsername,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
    session: Session = DependsOnDbSession,
):
    catalog_document, status = add_document(
        session,
        indexer,
        identifier,
        username,
        category_id,
        pages_count_manual,
        extraction_priority,
    )
    return AddDocumentResponse(
        identifier=identifier, status=status, document=catalog_document
    )


@router.put(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=DocumentResponse,
)
def update_document(
    document_id: int = Path(...),
    category_id: Optional[int] = Query(None),
    pages_count_manual: Optional[int] = Query(None),
    extraction_priority: Optional[int] = Query(None),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentEdit(user, document_id, session)
    document = Document.get(session, document_id)
    if category_id:
        document.category_id = category_id
    if pages_count_manual:
        document.pages_count_manual = pages_count_manual
    if extraction_priority:
        document.extraction_priority = extraction_priority
    return document.save(session)


@router.delete(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=DocumentResponse,
)
def delete_document(
    document_id: int = Path(...),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentEdit(user, document_id, session)
    return Document.get(session, document_id).delete(session)


@router.get(
    "/{document_id}",
    dependencies=[CanReadDocument],
    response_model=DocumentResponse,
)
def get_document(
    document_id: int = Path(...),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentRead(user, document_id, session)
    return Document.get(session, document_id)


@router.post("/query", dependencies=[CanReadDocuments], response_model=None)
def query_documents(
    query_params: ElasticsearchParams,
    user: CurrentUser = DependsOnCurrentUser,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
):
    if user.has_action(ActionType.ReadDatatableAll):
        return indexer.search(query_params)
    if user.has_action(ActionType.ReadDatatableDepartment):
        return indexer.search(
            DocumentsIndexer.restrict_query_params_for_categories(
                query_params, user.department_categories_ids, user.username
            )
        )
    return indexer.search(
        DocumentsIndexer.restrict_query_params_for_username(
            query_params, user.username
        )
    )


@router.post("/query/export", dependencies=[CanReadDocuments])
def export_query_documents(
    query_params: ElasticsearchParams,
    user: CurrentUser = DependsOnCurrentUser,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
    session: Session = DependsOnDbSession,
):
    df = pd.DataFrame(
        hit["_source"]
        for hit in query_documents(query_params, user, indexer, session)[
            "hits"
        ]["hits"]
    )

    with tempfile.NamedTemporaryFile(
        suffix=".xlsx", delete=False
    ) as temp_excel:
        df.to_excel(temp_excel.name, index=False)
        temp_filename = temp_excel.name

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    export_filename = f"vera-documents_{timestamp}.xlsx"

    return FileResponse(
        temp_filename,
        media_type=XLSX_MIMETYPE,
        filename=export_filename,
        headers={"Content-Disposition": "attachment"},
    )


@router.put(
    "/query/change_category",
    dependencies=[CanManageDocuments],
)
def update_query_documents(
    query_params: ElasticsearchParams,
    category_id: Optional[int] = None,
    user: CurrentUser = DependsOnCurrentUser,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
    session: Session = DependsOnDbSession,
):
    for document_id in indexer.get_document_ids(
        restrict_editing_query_params(query_params, user)
    ):
        document = Document.get(session, document_id)
        document.category_id = category_id
        document.save(session)


@router.post(
    "/query/delete",
    dependencies=[CanManageDocuments],
)
def delete_query_documents(
    query_params: ElasticsearchParams,
    user: CurrentUser = DependsOnCurrentUser,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
    session: Session = DependsOnDbSession,
):
    for document_id in indexer.get_document_ids(
        restrict_editing_query_params(query_params, user)
    ):
        Document.get(session, document_id).delete(session)


# @router.post("/documents/{id}/comments", response_model=Comment)
# def create_comment(
#     comment: CommentCreate,
#     id: int = Path(...),
#     user: CurrentUser = Depends(get_current_user),
#     db: Session = Depends(get_session),
# ):
#     return crud.create_comment(comment, id, user.id, db)


# @router.put(
#     "/documents/{document_id}/comments/{comment_id}",
#     response_model=Comment,
# )
# def update_comment(
#     comment: Comment,
#     document_id: int = Path(...),
#     user: CurrentUser = Depends(get_current_user),
#     db: Session = Depends(get_session),
# ):
#     return crud.update_comment(comment, db)


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


# @router.get(
#     "/documents/{document_id}/comments", response_model=List[Comment]
# )
# def get_note(document_id: int = Path(...), db: Session = Depends(get_session)):
#     return crud.get_comments_for_document(document_id, db)
