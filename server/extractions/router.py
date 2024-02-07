from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from services.database import get_db
from auth.auth import oauth2_scheme
from auth.router import get_current_user
from extractions import crud, schemas


router = APIRouter()


@router.post("/extract/generate", response_model=schemas.Extraction)
def generate_extraction(pages_count: int = Query(0),
                        db: Session = Depends(get_db)):
    if pages_count <= 0:
        return
    pass


@router.post("/extract", response_model=schemas.Extraction)
def create_extraction(extraction: schemas.ExtractionCreate,
                      token: str = Depends(oauth2_scheme),
                      db: Session = Depends(get_db)):
    user = get_current_user(db, token)
    return crud.create_extraction(extraction, user.id, db)
