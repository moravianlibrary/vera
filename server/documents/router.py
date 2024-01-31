from fastapi import APIRouter, Depends, Path, UploadFile, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from services.database import get_db
from roles.enums import ActionType
from services import exceptions
from auth.router import get_current_user
from documents import crud, schemas
from documents.enums import IdentifierType
from documents.routines import create_document_from_schema, \
    create_catalog_document
from auth.schemas import CurrentUser
from catalogs.routines import get_catalog_response


router = APIRouter()


@router.post("/documents", response_model=schemas.DocumentCreateResponse)
def create_document(document: schemas.DocumentCreate,
                    db: Session = Depends(get_db),
                    user: CurrentUser = Depends(get_current_user)):
    return create_document_from_schema(document, user.username, db)


@router.put("/documents/{id}", response_model=schemas.DocumentView)
def update_document(document: schemas.DocumentCreate,
                    id: int = Path(...),
                    db: Session = Depends(get_db),
                    user: CurrentUser = Depends(get_current_user)):
    return crud.update_document(id, document, user, db)


@router.delete("/documents/{id}", response_model=schemas.Document)
def delete_document(id: int = Path(...),
                    db: Session = Depends(get_db)):
    document = crud.get_document(id, db)
    if document is None:
        raise exceptions.DocumentNotFoundException(id)
    return crud.delete_document(id, db)


@router.get("/documents/{id}", response_model=schemas.DocumentView)
def get_document(id: int = Path(...),
                 db: Session = Depends(get_db)):
    document = crud.get_document(id, db)
    if document is None:
        raise exceptions.DocumentNotFoundException(id)
    return document


@router.get("/documents", response_model=schemas.DocumentsResponse)
def get_documents(query: Optional[schemas.DocumentsQuery] = None,
                  offset: int = Query(0, description="Pagination page offset"),
                  limit: int = Query(100, description="Pagination page size"),
                  user: CurrentUser = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    print(user.actions)
    if ActionType.read_datatable_all in user.actions:
        pass
    # elif ActionType.read_datatable_department in user.actions \
    #         and user.department_id is not None:
    #     if query is None:
    #         query = schemas.DocumentsQuery(
    #             department_id=user.department_id
    #         )
    elif ActionType.read_datatable_own in user.actions \
            or ActionType.read_datatable_department in user.actions:
        if query is None:
            query = schemas.DocumentsQuery(
                username=user.username
            )
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(
        db,
        query
    )
    documents = crud.get_documents(query_base, offset=offset, limit=limit)
    num_found = crud.get_documents_num_found(query_base)
    return schemas.DocumentsResponse(documents=documents, num_found=num_found)


@router.post("/documents/get_from_catalog",
             response_model=schemas.DocumentCatalogResponse)
async def get_from_catalog(identifier: schemas.Identifier,
                           user: CurrentUser
                           = Depends(get_current_user)):
    return get_catalog_response(identifier)


@router.post("/documents/get_from_catalog_file",
             response_model=List[schemas.DocumentCatalogResponse])
async def get_from_catalog_file(
        file: Optional[UploadFile] = None,
        identifier_type: IdentifierType = Query(IdentifierType.Sysno),
        user: CurrentUser = Depends(get_current_user)):
    if file and file.filename:
        return [get_catalog_response(schemas.Identifier
                                     (identifier_type=identifier_type,
                                      value=line))
                for line in (await file.read()).decode('utf-8').splitlines()]
    raise exceptions.MissingArgumentException(
        "File must be provided")


@router.post("/documents/create_from_catalog",
             response_model=schemas.DocumentCreateResponse)
async def create_from_catalog(identifier: Optional[schemas.Identifier] = None,
                              category_id: Optional[int] = Query(None),
                              insert_digitized: bool = Query(False),
                              db: Session = Depends(get_db),
                              user: CurrentUser
                              = Depends(get_current_user)):
    return create_catalog_document(
        get_catalog_response(identifier),
        category_id,
        insert_digitized,
        user.username,
        db)


@router.post("/documents/create_from_catalog_file",
             response_model=List[schemas.DocumentCreateResponse])
async def create_from_catalog_file(
        file: Optional[UploadFile] = None,
        identifier_type: IdentifierType = Query(IdentifierType.Sysno),
        category_id: Optional[int] = Query(None),
        insert_digitized: bool = Query(False),
        db: Session = Depends(get_db),
        user: CurrentUser
        = Depends(get_current_user)):
    return [create_catalog_document(
        get_catalog_response(schemas.Identifier
                             (identifier_type=identifier_type,
                              value=line)),
        category_id,
        insert_digitized,
        user.username,
        db)
            for line in (await file.read()).decode('utf-8').splitlines()]
