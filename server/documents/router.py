from fastapi import APIRouter, Depends, Path, UploadFile, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from services.database import get_db
from roles.enums import ActionType
from services import exceptions
from auth.router import get_current_user
from catalog import catalog
from . import crud, schemas
from users import schemas as users_schemas
from auth import schemas as auth_schemas


router = APIRouter()


@router.post("/documents", response_model=schemas.DocumentView)
def create_document(document: schemas.DocumentCreate,
                    db: Session = Depends(get_db),
                    user: users_schemas.User = Depends(get_current_user)):
    return crud.create_document(document, user, db)


@router.post("/documents/get_from_catalog",
             response_model=schemas.DocumentCatalog)
def get_from_catalog(identifier: schemas.Identifier = None,
                     file: UploadFile = None,
                     category_id: int = Query(0),
                     db: Session = Depends(get_db),
                     user: users_schemas.User = Depends(get_current_user)):
    if identifier:
        pass
    elif file:
        pass
    else:
        raise exceptions.MissingArgumentException(
            "Either document or file must be provided")


@router.post("/documents/create_from_catalog",
             response_model=schemas.DocumentView)
def create_from_catalog(identifier: schemas.Identifier = None,
                        file: UploadFile = None,
                        category_id: Optional[int] = Query(None),
                        db: Session = Depends(get_db),
                        user: users_schemas.User = Depends(get_current_user)):
    if identifier:
        catalog.generate_record_by_identifier(identifier)
        pass


# @router.post("/documents/precreate_by_identifier",
# response_model=schemas.DocumentPrecreateResult)
# def precreate_by_identifier(identifier: schemas.Identifier,
#                             db: Session = Depends(get_db)):
#     try:
#         return schemas.DocumentPrecreateResult(
#             document=catalog.generate_document_by_identifier(identifier),
#             identifier=identifier
#         )
#     except exceptions.CatalogException as e:
#         print(type(e).__name__)
#         return schemas.DocumentPrecreateResult(
#             identifier=identifier,
#             error_type=(type(e).__name__)
#         )


# @router.post("/documents/precreate_from_file/{category_id}",
# response_model=List[schemas.DocumentPrecreate])
# async def create_documents(file: UploadFile,
#                          category_id: int,
#                          db: Session = Depends(get_db),
#                          user: users_schemas.User = Depends(get_current_user)):
#     pass


# @router.post("/documents/create_from_file/{category_id}",
# response_model=List[schemas.DocumentCreateResult])
# async def create_documents(
#                         file: UploadFile,
#                          category_id: int,
#                          db: Session = Depends(get_db),
#                          user: users_schemas.User = Depends(get_current_user)):
#     if file.filename:
#         documents = []
#         for document_precreate in catalog.generate_documents_from_file(
    # (await file.read()).decode('utf-8')):
#             if crud.get_document_by_identifiers(document_precreate.sysno,
#                     document_precreate.volume_number,
#                     document_precreate.item_number,
#                     db) is not None:
#                 continue
#             documents.routerend(crud.create_document(
#                 schemas.DocumentCreate.from_document_precreate(
    # document_precreate, category_id),
#                 user,
#                 db))
#         return documents


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
    documents = crud.get_documents(db, query_base, offset=offset, limit=limit)
    num_found = crud.get_documents_num_found(db, query_base)
    return schemas.DocumentsResponse(documents=documents, num_found=num_found)


@router.post("/documents/{id}/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate,
                   id: int = Path(...),
                   user: users_schemas.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.create_comment(comment, id, user.id, db)


@router.put("/documents/{document_id}/comments/{comment_id}",
            response_model=schemas.Comment)
def update_comment(comment: schemas.Comment,
                   document_id: int = Path(...),
                   user: users_schemas.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.update_comment(comment, db)


@router.delete("/documents/{document_id}/comments/{comment_id}",
               response_model=schemas.Comment)
def delete_comment(document_id: int = Path(...),
                   comment_id: int = Path(...),
                   user: users_schemas.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.delete_comment(comment_id, db)


@router.get("/documents/{document_id}/comments/{comment_id}",
            response_model=schemas.Comment)
def get_comment(document_id: int = Path(...),
                comment_id: int = Path(...),
                db: Session = Depends(get_db)):
    return crud.get_comment(comment_id, db)


@router.get("/documents/{document_id}/comments",
            response_model=List[schemas.Comment])
def get_note(document_id: int = Path(...),
             db: Session = Depends(get_db)):
    return crud.get_comments_for_document(document_id, db)
