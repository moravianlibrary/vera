from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from typing import List

from services.database import get_db
from auth.router import get_current_user
from auth.schemas import CurrentUser
from . import crud, schemas


router = APIRouter()


@router.post("/documents/{id}/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate,
                   id: int = Path(...),
                   user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.create_comment(comment, id, user.id, db)


@router.put("/documents/{document_id}/comments/{comment_id}",
            response_model=schemas.Comment)
def update_comment(comment: schemas.Comment,
                   document_id: int = Path(...),
                   user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.update_comment(comment, db)


@router.delete("/documents/{document_id}/comments/{comment_id}",
               response_model=schemas.Comment)
def delete_comment(document_id: int = Path(...),
                   comment_id: int = Path(...),
                   user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    return crud.delete_comment(comment_id, db)


@router.get("/documents/{document_id}/comments",
            response_model=List[schemas.Comment])
def get_note(document_id: int = Path(...),
             db: Session = Depends(get_db)):
    return crud.get_comments_for_document(document_id, db)
