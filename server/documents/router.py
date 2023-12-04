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
from users import schemas as users_schemas
from auth import schemas as auth_schemas
from catalogs.routines import get_catalog_response


router = APIRouter()


@router.post("/documents", response_model=schemas.DocumentCreateResponse)
def create_document(document: schemas.DocumentCreate,
                    db: Session = Depends(get_db),
                    user: users_schemas.User = Depends(get_current_user)):
    return create_document_from_schema(document, user.id, db)


@router.put("/documents/{id}", response_model=schemas.DocumentView)
def update_document(document: schemas.DocumentCreate,
                    id: int = Path(...),
                    db: Session = Depends(get_db),
                    user: users_schemas.User = Depends(get_current_user)):
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
def get_documents(offset: int = Query(0, description="Pagination page offset"),
                  limit: int = Query(100, description="Pagination page size"),
                  sysno: Optional[str] =
                  Query(None, description="document sysno"),
                  extraction_id: Optional[int] =
                  Query(None, description="document extraction id"),
                  onlyExtracted: Optional[str] =
                  Query(None, description="Show only extracted"),
                  user: auth_schemas.CurrentUser = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    user_id, department_id = None, None
    if ActionType.read_datatable_department in user.actions \
            and user.department_id is not None:
        department_id = user.department_id
    elif ActionType.read_datatable_own in user.actions:
        user_id = user.id
    elif ActionType.read_datatable_all not in user.actions:
        raise exceptions.UserNotAllowedToReadDocumentsException

    query_base = crud.get_documents_query_base(
        db,
        sysno=sysno,
        creator_id=user_id,
        creator_department_id=department_id,
        extraction_id=extraction_id,
        onlyExtracted=(onlyExtracted is not None)
    )
    documents = crud.get_documents(query_base, offset=offset, limit=limit)
    num_found = crud.get_documents_num_found(query_base)
    return schemas.DocumentsResponse(documents=documents, num_found=num_found)


@router.post("/documents/get_from_catalog",
             response_model=schemas.DocumentCatalogResponse)
async def get_from_catalog(identifier: schemas.Identifier,
                           user: users_schemas.User
                           = Depends(get_current_user)):
    return get_catalog_response(identifier)


@router.post("/documents/get_from_catalog_file",
             response_model=List[schemas.DocumentCatalogResponse])
async def get_from_catalog_file(
        file: Optional[UploadFile] = None,
        identifier_type: IdentifierType = Query(IdentifierType.SYSNO),
        user: users_schemas.User = Depends(get_current_user)):
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
                              user: users_schemas.User
                              = Depends(get_current_user)):
    return create_catalog_document(
        get_catalog_response(identifier),
        category_id,
        insert_digitized,
        user.id,
        db)


@router.post("/documents/create_from_catalog_file",
             response_model=List[schemas.DocumentCreateResponse])
async def create_from_catalog_file(
        file: Optional[UploadFile] = None,
        identifier_type: IdentifierType = Query(IdentifierType.SYSNO),
        category_id: Optional[int] = Query(None),
        insert_digitized: bool = Query(False),
        db: Session = Depends(get_db),
        user: users_schemas.User
        = Depends(get_current_user)):
    return [create_catalog_document(
        get_catalog_response(schemas.Identifier
                             (identifier_type=identifier_type,
                              value=line)),
        category_id,
        insert_digitized,
        user.id,
        db)
            for line in (await file.read()).decode('utf-8').splitlines()]
