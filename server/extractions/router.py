from fastapi import APIRouter, Depends, Path, Query
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
    if props.pages_count <= 0:
        raise EmptyExtraction
    selected_documents, selected_pages_count = generate_extraction(
        props, props.pages_count, db
    )
    extraction = crud.create_extraction(user.username, selected_documents, db)
    crud.set_documents_extracted(extraction.id, db)
    return extraction


@router.post("/extract/{id}/mark")
def mark_extraction(id: int = Path(...),
                    db: Session = Depends(get_db)):
    crud.set_documents_extracted(id, db)


@router.post("/extract/{id}/unmark")
def unmark_extraction(id: int = Path(...),
                      db: Session = Depends(get_db)):
    crud.unset_documents_extracted(id, db)


@router.get("/extract", response_model=schemas.Extractions)
def get_extractions(offset: int = Query(0, description="Pagination offset"),
                    limit: int = Query(50, description="Pagination page size"),
                    db: Session = Depends(get_db)):
    return schemas.Extractions(
        extractions=crud.get_extractions(db, offset, limit),
        num_found=crud.get_extractions_num_found(db)
    )
