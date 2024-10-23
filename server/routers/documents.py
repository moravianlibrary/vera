from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional
from schemas import (
    CurrentUser,
    AddDocumentResponse,
    Identifier,
)
from datatypes import ElasticsearchParams, EsRoutingParams
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
    DependsOnEsSession,
)
from logic.add_document import add_document
from schemas import IndexDocument, EsSession
from starlette.responses import FileResponse
import pandas as pd
import tempfile
from datetime import datetime
from .utils.query_restrictions import (
    restrict_read_query_params,
    restrict_edit_query_params,
)
from .utils.query_routing_parser import parse_query_routing


XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/from_catalog",
    dependencies=[CanInsertDocument],
    response_model=AddDocumentResponse,
)
async def add_document_from_catalog(
    identifier: Identifier,
    category_id: int = Query(),
    predict_pages_count: bool = Query(True),
    extraction_priority: Optional[int] = Query(None),
    pages_count_manual: Optional[int] = Query(None),
    username: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    catalog_document, status = add_document(
        session,
        es_session,
        identifier,
        username,
        category_id,
        predict_pages_count,
        extraction_priority,
        pages_count_manual,
    )
    return AddDocumentResponse(
        identifier=identifier, status=status, document=catalog_document
    )


@router.put(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=IndexDocument,
)
def update_document(
    document_id: int = Path(...),
    category_id: Optional[int] = Query(None),
    pages_count_manual: Optional[int] = Query(None),
    extraction_priority: Optional[int] = Query(None),
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
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
    document.save(session)
    IndexDocument.model_validate(document).save(es_session, True)
    return document


@router.delete(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=IndexDocument,
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
    response_model=IndexDocument,
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
    es_session: EsSession = DependsOnEsSession,
):
    return IndexDocument.search(
        es_session, restrict_read_query_params(query_params, user)
    )


@router.post("/query/export", dependencies=[CanReadDocuments])
def export_query_documents(
    query_routing_params: EsRoutingParams,
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
):
    df = pd.DataFrame(
        hit["_source"]
        for hit in query_documents(
            parse_query_routing(query_routing_params), user, es_session
        )["hits"]["hits"]
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
    "/query/update_property",
    dependencies=[CanManageDocuments],
)
def update_query_documents(
    query_routing_params: EsRoutingParams,
    category_id: Optional[int] = Query(None),
    pages_count_manual: Optional[int] = Query(None),
    extraction_priority: Optional[int] = Query(None),
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    if not category_id and not pages_count_manual and not extraction_priority:
        return
    for document_id in IndexDocument.search_source_ids(
        es_session,
        restrict_edit_query_params(
            parse_query_routing(query_routing_params), user
        ),
    ):
        document = Document.get(session, document_id)
        if category_id:
            document.category_id = category_id
        if pages_count_manual:
            document.pages_count_manual = pages_count_manual
        if extraction_priority:
            document.extraction_priority = extraction_priority
        document.save(session)
        IndexDocument.model_validate(document).save(es_session)


@router.post(
    "/query/delete",
    dependencies=[CanManageDocuments],
)
def delete_query_documents(
    query_routing_params: EsRoutingParams,
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    for document_id in IndexDocument.search_source_ids(
        es_session,
        restrict_edit_query_params(
            parse_query_routing(query_routing_params), user
        ),
    ):
        Document.get(session, document_id).delete(session)
        IndexDocument.delete(es_session, document_id)


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
