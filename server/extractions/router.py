from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.database import get_db
from auth.auth import oauth2_scheme, get_current_user
from extractions import crud, schemas
from auth.schemas import CurrentUser


router = APIRouter()


@router.post("/extract", response_model=schemas.Extraction)
def create_extraction(extraction: schemas.ExtractionCreate,
                      token: str = Depends(oauth2_scheme),
                      db: Session = Depends(get_db)):
    user = get_current_user(db, token)
    return crud.create_extraction(extraction, user.id, db)
