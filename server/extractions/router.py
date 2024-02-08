from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.database import get_db
from auth.schemas import CurrentUser
from auth.router import get_current_user
from extractions import crud, schemas
from extractions.routines import generate_extraction
from services.exceptions import EmptyExtraction


router = APIRouter()


@router.post("/extract/preview", response_model=schemas.Extraction)
def get_extraction_preview(props: schemas.ExtractionCreatePreview,
                           user: CurrentUser = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    if props.pages_count <= 0:
        raise EmptyExtraction
    selected_documents, selected_pages_count = generate_extraction(
        props, props.pages_count, db
    )
    return crud.create_extraction(user.username, selected_documents, db)


@router.post("/extract/generate", response_model=schemas.Extraction)
def create_extraction(props: schemas.ExtractionCreate,
                      user: CurrentUser = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    pass
