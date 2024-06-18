from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from security.types import ActionType
import crud.documents as crud
import crud.catalog_documents as catalog_crud
import schemas.documents as schemas
import schemas.documents_query as query_schemas
from catalogs.schemas import Identifier
from security.schemas import CurrentUser
from catalogs.routines import generate_catalog_document

import providers.documents as documents_provider
from routers.utils.permissions import (
    CanCreateDocument,
    CanInsertDocument,
    CanManageDocument,
    CanReadDocument,
    CanReadDocuments,
    CanManageDocuments,
)
from routers.utils.dependencies import (
    DependsOnCurrentUser,
    DependsOnDbSession,
    DependsOnCallerUsername,
)


router = APIRouter(prefix="/documents")


@router.post(
    "/new",
    dependencies=[CanCreateDocument],
    response_model=schemas.DocumentCreateResponse,
)
def create_document(
    document: schemas.DocumentCreate,
    username: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
):
    return crud.create_document(document, username, session)


@router.post(
    "/from_catalog",
    dependencies=[CanInsertDocument],
    response_model=schemas.DocumentCreateResponse,
)
async def create_from_catalog(
    document_identifier: Identifier,
    category_id: Optional[int] = Query(None),
    insert_digitized: bool = Query(False),
    username: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
):
    return catalog_crud.create_catalog_document(
        generate_catalog_document(document_identifier),
        document_identifier,
        category_id,
        insert_digitized,
        username,
        session,
    )


@router.put(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=schemas.Document,
)
def update_document(
    document: schemas.DocumentCreate,
    document_id: int = Path(...),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    return crud.update_document(
        document_id,
        document,
        ActionType.WriteDatatable in user.actions,
        session,
    )


@router.delete(
    "/{document_id}",
    dependencies=[CanManageDocument],
    response_model=schemas.Document,
)
def delete_document(
    document_id: int = Path(...), session: Session = DependsOnDbSession
):
    return crud.delete_document(document_id, session)


@router.get(
    "/{document_id}",
    dependencies=[CanReadDocument],
    response_model=schemas.Document,
)
def get_document(
    document_id: int = Path(...), session: Session = DependsOnDbSession
):
    return crud.get_document(document_id, session)


@router.post(
    "/query",
    dependencies=[CanReadDocuments],
    response_model=schemas.DocumentsResponse,
)
def query_documents(
    query: query_schemas.DocumentsQuery,
    offset: int = Query(0, description="Pagination offset"),
    limit: int = Query(100, description="Pagination size"),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    return documents_provider.query_documents(
        user, session, query, offset, limit
    )


@router.get(
    "",
    dependencies=[CanReadDocuments],
    response_model=schemas.DocumentsResponse,
)
def get_documents(
    offset: int = Query(0, description="Pagination page offset"),
    limit: int = Query(100, description="Pagination page size"),
    user: CurrentUser = DependsOnCurrentUser,
    session: Session = DependsOnDbSession,
):
    return documents_provider.query_documents(
        user, session, offset=offset, limit=limit
    )


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
