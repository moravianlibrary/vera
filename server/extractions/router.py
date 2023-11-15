# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session

# from services.database import get_db
# from auth.auth import get_current_user
# from . import crud, schemas
# from auth.schemas import CurrentUser


# router = APIRouter()


# @router.post("/extract", response_model=None)
# def create_extraction(extraction: schemas.ExtractionCreate,
#                       user: CurrentUser = Depends(get_current_user),
#                       db: Session = Depends(get_db)):
#     crud.create_extraction(extraction, user.id, db)
#     pass
