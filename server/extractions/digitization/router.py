from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from security.schemas import CurrentUser
from routers.security import get_current_user
from schemas.documents_query import DocumentsQuery
from extractions.digitization import crud, schemas
from extractions.digitization.routines import (
    get_extraction_from_query,
    get_extraction_documents_from_query,
)

# from extractions.routines import get_category_subtree
# from extractions.schemas import ExtractionCategoryNode
from services.database import get_db
from extractions.permissions import CanExtract, CanManageDigitizationList

router = APIRouter(prefix="/extractions/digitization")


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=schemas.DigitizationExtraction,
)
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


@router.get(
    "",
    dependencies=[CanExtract],
    response_model=schemas.DigitizationExtractions,
)
def get_extractions(
    offset: int = Query(0, description="Pagination offset"),
    limit: int = Query(50, description="Pagination page size"),
    db: Session = Depends(get_db),
):
    return schemas.DigitizationExtractions(
        extractions=crud.get_extractions(db, offset, limit),
        num_found=crud.get_extractions_num_found(db),
    )


@router.get(
    "/{id}",
    dependencies=[CanExtract],
    response_model=schemas.DigitizationExtraction,
)
def get_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.get_extraction(id, db)


@router.put(
    "/{id}/add_documents",
    dependencies=[CanManageDigitizationList],
    response_model=schemas.DigitizationExtraction,
)
def add_documents_to_extraction(
    query: DocumentsQuery,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    document_ids, extracted_pages = get_extraction_from_query(query, db)
    return crud.add_documents_to_extraction(
        id, document_ids, extracted_pages, db
    )


@router.put(
    "/{id}/remove_documents",
    dependencies=[CanManageDigitizationList],
    response_model=schemas.DigitizationExtraction,
)
def remove_documents_from_extraction(
    query: DocumentsQuery,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    document_ids, pages_count = get_extraction_documents_from_query(
        id, query, db
    )
    return crud.remove_documents_from_extraction(
        id, document_ids, pages_count, db
    )


@router.delete(
    "/{id}",
    dependencies=[CanManageDigitizationList],
    response_model=schemas.DigitizationExtraction,
)
def delete_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_extraction(id, db)


# TODO:
# @router.get(
#     "/{id}/categories",
#     dependencies=[CanExtract],
#     response_model=List[ExtractionCategoryNode],
# )
# def get_categories(id: int = Path(...), db: Session = Depends(get_db)):
#     extraction = crud.get_extraction(id, db)
#     return [
#         get_category_subtree(extraction.document_ids, root_category, db)
#         for root_category in get_root_categories(db)
#     ]
