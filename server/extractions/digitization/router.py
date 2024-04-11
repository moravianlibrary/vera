from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from auth.schemas import CurrentUser
from auth.router import get_current_user
from categories.crud import get_root_categories
from documents.schemas import DocumentsQuery
from extractions.digitization import crud, schemas
from extractions.digitization.routines import get_extraction_from_query
from extractions.routines import get_category_subtree
from extractions.schemas import ExtractionCategoryNode
from services.database import get_db


router = APIRouter(prefix="/extractions/digitization")


@router.post("", response_model=schemas.DigitizationExtraction)
def create_extraction(
    query: DocumentsQuery,
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document_ids, extracted_pages = get_extraction_from_query(query, db)
    return crud.create_extraction(
        document_ids,
        extracted_pages,
        intention_id,
        user.username,
        db,
    )


@router.get("", response_model=schemas.DigitizationExtractions)
def get_extractions(
    offset: int = Query(0, description="Pagination offset"),
    limit: int = Query(50, description="Pagination page size"),
    db: Session = Depends(get_db),
):
    return schemas.DigitizationExtractions(
        extractions=crud.get_extractions(db, offset, limit),
        num_found=crud.get_extractions_num_found(db),
    )


@router.get("/{id}", response_model=schemas.DigitizationExtraction)
def get_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.get_extraction(id, db)


@router.put("/{id}", response_model=schemas.DigitizationExtraction)
def update_extraction(
    query: DocumentsQuery,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    document_ids, extracted_pages = get_extraction_from_query(query, db)
    return crud.update_extraction(id, document_ids, extracted_pages, db)


@router.delete("/{id}", response_model=schemas.DigitizationExtraction)
def delete_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_extraction(id, db)


@router.get(
    "/{id}/categories",
    response_model=List[ExtractionCategoryNode],
)
def get_categories(id: int = Path(...), db: Session = Depends(get_db)):
    extraction = crud.get_extraction(id, db)
    return [
        get_category_subtree(extraction.document_ids, root_category, db)
        for root_category in get_root_categories(db)
    ]
