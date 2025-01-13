from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Set, Tuple
from schemas import CurrentUser, IdentifierWithAttributes
from datatypes import (
    ElasticsearchParams,
    EsRoutingParams,
    AddDocumentResponseStatus,
    IdentifierType,
)
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
from schemas import IndexDocument, EsSession, AddDocumentResponse
from starlette.responses import FileResponse
import pandas as pd
import tempfile
from datetime import datetime
from .utils.query_restrictions import (
    restrict_read_query_params,
    restrict_edit_query_params,
    restrict_query_params_for_username,
)
from .utils.query_routing_parser import parse_query_routing
from worker import run_add_documents


XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/from_catalog",
    dependencies=[CanInsertDocument],
    response_model=None,
)
async def add_document_from_catalog(
    attributes: IdentifierWithAttributes | List[IdentifierWithAttributes],
    predict_pages_count: bool = Query(True),
    caller: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
):
    if isinstance(attributes, list):
        processed_attributes: Set[Tuple[IdentifierType, str]] = set()
        for curr_attributes in attributes:
            if curr_attributes.identifier_pair in processed_attributes:
                continue
            processed_attributes.add(curr_attributes.identifier_pair)

            AddDocumentResponse(
                attributes=curr_attributes, added_by=caller
            ).save(es_session, True)
    else:
        AddDocumentResponse(attributes=attributes, added_by=caller).save(
            es_session, True
        )
    run_add_documents.delay()


@router.post(
    "/from_catalog/responses",
    dependencies=[CanReadDocuments],
    response_model=None,
)
def search_add_documents_responses(
    query_params: ElasticsearchParams,
    caller: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
):
    return AddDocumentResponse.search(
        es_session, restrict_query_params_for_username(query_params, caller)
    )


@router.post(
    "/from_catalog/responses/{response_id}",
    dependencies=[CanReadDocuments],
    response_model=None,
)
def add_document_issue(
    attributes: IdentifierWithAttributes | List[IdentifierWithAttributes],
    response_id: str = Path(...),
    caller: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
):
    response = AddDocumentResponse.model_validate(
        AddDocumentResponse.get(es_session, response_id)
    )

    if not isinstance(attributes, list):
        attributes = [attributes]

    for curr_attributes in attributes:
        response.set_issue_processing(curr_attributes.value)
        response.save(es_session, True)

    for curr_attributes in attributes:
        AddDocumentResponse(attributes=curr_attributes, added_by=caller).save(
            es_session, True
        )

    run_add_documents.delay()


@router.patch(
    "/from_catalog/responses/{response_id}/document/{document_id}",
    dependencies=[CanReadDocuments],
    response_model=None,
)
def patch_document_issue(
    response_id: str = Path(...),
    document_id: int = Path(...),
    page_count_manual: int = Query(...),
    caller: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    if not page_count_manual:
        return

    response = AddDocumentResponse.model_validate(
        AddDocumentResponse.get(es_session, response_id)
    )

    if response.status not in [
        AddDocumentResponseStatus.SuccessWithMissingPageCount,
        AddDocumentResponseStatus.MultipleIssues,
    ]:
        return

    document = Document.get(session, document_id)
    document.pages_count_manual = page_count_manual
    document.save(session)
    IndexDocument.model_validate(document).save(es_session)

    issue = [
        i for i in response.document.issues if i.document_id == document_id
    ][0]
    issue.page_count = document.pages_count

    for response in AddDocumentResponse.get_responses_with_sysno(
        es_session, response.document.sysno
    ):
        if (
            response.status
            == AddDocumentResponseStatus.SuccessWithMissingPageCount
            and response.document_id == document_id
        ):
            response.status = AddDocumentResponseStatus.Success
        if response.status == AddDocumentResponseStatus.MultipleIssues:
            issue.newly_added = True
        else:
            issue.newly_added = False
        response.replace_issue(issue)
        response.save(es_session, True)


@router.delete(
    "/from_catalog/responses",
    dependencies=[CanReadDocuments],
    response_model=None,
)
def delete_add_documents_responses(
    caller: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
):
    for uuid in AddDocumentResponse.search_source_ids(
        es_session,
        restrict_query_params_for_username(
            {
                "query": {
                    "match_all": {},
                },
            },
            caller,
        ),
    ):
        AddDocumentResponse.delete(es_session, uuid, True)


@router.put(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=IndexDocument,
    response_model_exclude_unset=True,
)
def update_document(
    document_id: int = Path(...),
    category_id: Optional[int] = Query(None),
    page_count_manual: Optional[int] = Query(None),
    extraction_priority: Optional[int] = Query(None),
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentEdit(user, document_id, session)
    document = Document.get(session, document_id)
    if category_id:
        document.category_id = category_id
    if page_count_manual:
        document.pages_count_manual = page_count_manual
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
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentEdit(user, document_id, session)
    document = Document.get(session, document_id).delete(session)
    IndexDocument.delete(es_session, document_id)
    return document


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
        IndexDocument.search_all(
            es_session,
            restrict_read_query_params(
                parse_query_routing(query_routing_params), user
            ),
        )
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
    page_count_manual: Optional[int] = Query(None),
    extraction_priority: Optional[int] = Query(None),
    user: CurrentUser = DependsOnCurrentUser,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    if not category_id and not page_count_manual and not extraction_priority:
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
        if page_count_manual:
            document.pages_count_manual = page_count_manual
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
