from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from starlette.responses import FileResponse
import pandas as pd
import tempfile
from typing import List, Optional

from services.database import get_db
from roles.types import ActionType
from services import exceptions
from auth.router import get_current_user
from documents import crud, schemas
from catalogs.schemas import CatalogResponse, Identifier
from catalogs.enums import IdentifierType
from documents.routines import (
    create_document as create_document_routine,
    create_catalog_document,
)
from auth.schemas import CurrentUser
from catalogs.routines import generate_catalog_document


router = APIRouter()


@router.post("/documents", response_model=schemas.DocumentCreateResponse)
def create_document(
    document: schemas.DocumentCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return create_document_routine(document, user.username, db)


@router.put("/documents/{id}", response_model=schemas.DocumentView)
def update_document(
    document: schemas.DocumentCreate,
    id: int = Path(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return crud.update_document(id, document, user, db)


@router.delete("/documents/{id}", response_model=schemas.Document)
def delete_document(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_document(id, db)


@router.get("/documents/{id}", response_model=schemas.DocumentView)
def get_document(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.get_document(id, db)


@router.get("/documents", response_model=schemas.DocumentsResponse)
def get_documents(
    offset: int = Query(0, description="Pagination page offset"),
    limit: int = Query(100, description="Pagination page size"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = None
    if ActionType.ReadDatatableAll in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        query = schemas.DocumentsQuery(username=user.username)
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(db, query)
    documents = crud.get_documents(query_base, offset=offset, limit=limit)
    num_found = crud.get_documents_num_found(query_base)
    return schemas.DocumentsResponse(documents=documents, num_found=num_found)


@router.post("/documents/query", response_model=schemas.DocumentsResponse)
def query_documents(
    query: schemas.DocumentsQuery,
    offset: int = Query(0, description="Pagination offset"),
    limit: int = Query(100, description="Pagination size"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadDatatableAll in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        if query is None:
            query = schemas.DocumentsQuery(username=user.username)
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(db, query)
    documents = crud.get_documents(query_base, offset=offset, limit=limit)
    num_found = crud.get_documents_num_found(query_base)
    return schemas.DocumentsResponse(documents=documents, num_found=num_found)


@router.post("/documents/query/export")
def download_documents(
    query: schemas.DocumentsQuery,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadDatatableAll in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        if query is None:
            query = schemas.DocumentsQuery(username=user.username)
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(db, query)
    num_found = crud.get_documents_num_found(query_base)

    documents = crud.get_documents(query_base, limit=num_found)
    documents_data = [
        crud.documents_view_to_dict(document) for document in documents
    ]

    df = pd.DataFrame(documents_data)

    with tempfile.NamedTemporaryFile(
        suffix=".xlsx", delete=False
    ) as temp_excel:
        df.to_excel(temp_excel.name, index=False)

    return FileResponse(
        temp_excel.name,
        media_type=(
            "application/vnd."
            "openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        filename="documents.xlsx",
        headers={"Content-Disposition": "attachment"},
    )


@router.put("/documents/query/category", response_model=schemas.DocumentsQuery)
def update_query_documents(
    query: schemas.DocumentsQuery,
    category_id: Optional[int] = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadDatatableAll in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        if query is None:
            query = schemas.DocumentsQuery(username=user.username)
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(db, query)
    crud.update_documents(query_base, "category_id", category_id, db)
    return query


@router.post("/documents/query/delete", response_model=schemas.DocumentsQuery)
def delete_query_documents(
    query: schemas.DocumentsQuery,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ActionType.ReadDatatableAll in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        if query is None:
            query = schemas.DocumentsQuery(username=user.username)
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(db, query)
    crud.delete_documents(query_base, db)
    return query


@router.get(
    "/catalogs",
    response_model=CatalogResponse,
)
async def get_from_catalog(
    identifier_type: IdentifierType = Query(IdentifierType.Sysno),
    value: str = Query(...),
):
    return generate_catalog_document(
        Identifier(identifier_type=identifier_type, value=value)
    )


@router.post(
    "/catalogs",
    response_model=schemas.DocumentCreateResponse,
)
async def create_from_catalog(
    identifier: Optional[Identifier] = None,
    category_id: Optional[int] = Query(None),
    insert_digitized: bool = Query(False),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return create_catalog_document(
        generate_catalog_document(identifier),
        identifier,
        category_id,
        insert_digitized,
        user.username,
        db,
    )


@router.get(
    "/catalogs/list",
    response_model=List[CatalogResponse],
)
async def get_from_catalog_file(
    identifier_type: IdentifierType = Query(IdentifierType.Sysno),
    values: List[str] = Query(...),
):
    return [
        generate_catalog_document(
            Identifier(identifier_type=identifier_type, value=value)
        )
        for value in values
    ]


@router.post(
    "/catalogs/list",
    response_model=List[schemas.DocumentCreateResponse],
)
async def create_from_catalog_file(
    identifier_type: IdentifierType = Query(IdentifierType.Sysno),
    values: List[str] = Query(...),
    category_id: Optional[int] = Query(None),
    insert_digitized: bool = Query(False),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return [
        create_catalog_document(
            generate_catalog_document(
                Identifier(identifier_type=identifier_type, value=value)
            ),
            Identifier(identifier_type=identifier_type, value=value),
            category_id,
            insert_digitized,
            user.username,
            db,
        )
        for value in values
    ]
