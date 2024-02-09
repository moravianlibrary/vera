from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List

from services.database import get_db
from auth.schemas import CurrentUser
from auth.router import get_current_user
from extractions import crud, schemas
from extractions.routines import generate_extraction, \
    get_category_subtree
from services.exceptions import EmptyExtraction
from categories.quotas.crud import get_quota
from categories.crud import get_root_categories


router = APIRouter()


@router.post("/extractions/generate", response_model=schemas.Extraction)
def create_extraction(props: schemas.ExtractionCreate,
                      pages_count: int = None,
                      quota_id: int = None,
                      user: CurrentUser = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    if quota_id is not None:
        pages_count = get_quota(quota_id, db).pages_count
    elif pages_count is None or pages_count <= 0:
        raise EmptyExtraction

    selected_documents, selected_pages_count = generate_extraction(
        props, props.pages_count, db
    )
    extraction = crud.create_extraction(
        user.username, selected_documents, db
    )
    if quota_id is not None:
        crud.set_documents_extracted(extraction.id, db)
    return extraction


@router.post("/extractions/{id}/mark")
def mark_extraction(id: int = Path(...),
                    db: Session = Depends(get_db)):
    crud.set_documents_extracted(id, db)


@router.post("/extractions/{id}/unmark")
def unmark_extraction(id: int = Path(...),
                      db: Session = Depends(get_db)):
    crud.unset_documents_extracted(id, db)


@router.get("/extractions", response_model=schemas.Extractions)
def get_extractions(offset: int = Query(0, description="Pagination offset"),
                    limit: int = Query(50, description="Pagination page size"),
                    db: Session = Depends(get_db)):
    return schemas.Extractions(
        extractions=crud.get_extractions(db, offset, limit),
        num_found=crud.get_extractions_num_found(db)
    )


@router.get("/extractions/{id}/categories",
            response_model=List[schemas.ExtractionCategoryNode])
def get_categories(id: int = Path(...),
                   db: Session = Depends(get_db)):
    return [get_category_subtree(id, root_category, db)
            for root_category in get_root_categories(db)]
