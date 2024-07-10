from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Dict, Optional

import crud.documents as crud
import schemas.documents as schemas
import schemas.documents_query as query_schemas
from catalogs.schemas import Identifier
from schemas.security import CurrentUser
from schemas.types.action_type import ActionType

import providers.documents as documents_provider
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
)
from procedures.add_document import add_document
from services.documents_index import DocumentsIndex


router = APIRouter(prefix="/documents")


@router.post(
    "/add_document_from_catalog",
    dependencies=[CanInsertDocument],
    response_model=schemas.AddDocumentResponse,
)
async def add_document_from_catalog(
    identifier: Identifier,
    category_id: int = Query(),
    pages_count_manual: Optional[int] = None,
    extraction_priority: Optional[int] = None,
    username: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
):
    catalog_document, status = add_document(
        session,
        identifier,
        username,
        category_id,
        pages_count_manual,
        extraction_priority,
    )
    return schemas.AddDocumentResponse(
        identifier=identifier, status=status, document=catalog_document
    )


@router.put(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=schemas.Document,
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
    return crud.update_document_properties(
        session,
        document_id,
        category_id,
        pages_count_manual,
        extraction_priority,
    )


@router.delete(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=schemas.Document,
)
def delete_document(
    document_id: int = Path(...),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentEdit(user, document_id, session)
    return crud.delete_document(document_id, session)


@router.get(
    "/{document_id}",
    dependencies=[CanReadDocument],
    response_model=schemas.Document,
)
def get_document(
    document_id: int = Path(...),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    OwnershipValidator.EnforceDocumentRead(user, document_id, session)
    return crud.get_document(document_id, session)


@router.post(
    "/query",
    dependencies=[CanReadDocuments],
)
def query_documents(
    query_params: Dict[str, any],
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    index_handler = DocumentsIndex()

    if user.has_action(ActionType.ReadDatatableAll):
        return index_handler.search(query_params)

    if user.has_action(ActionType.ReadDatatableDepartment):
        return index_handler.search_for_categories(
            query_params, user.department_categories_ids
        )

    return index_handler.search_for_user(user.username, query_params)


@router.get(
    "",
    dependencies=[CanReadDocuments],
    response_model=schemas.DocumentsResponse,
)
def get_documents(
    query_params: Dict[str, any] = Query(),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    return query_documents(query_params, user, session)


@router.post("/query/export", dependencies=[CanReadDocuments])
def export_query_documents(
    query: query_schemas.DocumentsQuery,
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    return documents_provider.export_query_documents(user, session, query)


@router.put(
    "/query/change_category",
    dependencies=[CanReadDocuments, CanManageDocuments],
    response_model=query_schemas.DocumentsQuery,
)
def update_query_documents(
    query: query_schemas.DocumentsQuery,
    category_id: Optional[int] = None,
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    query_base = crud.get_documents_query_base(
        session,
        documents_provider.filter_documents_query_by_user_permissions(
            user, query
        ),
    )
    crud.update_documents(query_base, "category_id", category_id, session)
    return query


@router.post(
    "/query/delete",
    dependencies=[CanReadDocuments, CanManageDocuments],
    response_model=query_schemas.DocumentsQuery,
)
def delete_query_documents(
    query: query_schemas.DocumentsQuery,
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    query_base = crud.get_documents_query_base(
        session,
        documents_provider.filter_documents_query_by_user_permissions(
            user, query
        ),
    )
    crud.delete_documents(query_base, session)
    return query
