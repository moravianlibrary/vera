from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from schemas import CurrentUser, Page, ExtractionResponse, GenerateExtraction
from routers.authorization import get_current_user
from models import Intention, Extraction
from services.extractions_generator.generator import ExtractionGenerator
from services.database import get_db
from .utils.permissions import CanExtract, CanManageExtraction


router = APIRouter(prefix="/extractions/generated")


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=ExtractionResponse,
)
def create_extraction(
    params: GenerateExtraction,
    pages_count: int = None,
    quota_id: int = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # TODO:
    # if quota_id is not None:
    # pages_count = get_quota(quota_id, db).pages_count
    # elif pages_count is None or pages_count <= 0:
    # raise EmptyExtraction

    generator = ExtractionGenerator(
        pages_count, Intention.get_current_intention(db).id, params, db
    )
    generator.generate()

    return Extraction(
        document_ids=generator.extracted_documents,
        selected_pages=generator.extracted_pages_count,
        target_pages=pages_count,
        include_categories=params.include_categories,
        location_ids=params.location_ids,
        target_pages_threshold=params.target_pages_threshold,
        whole_categories_threshold=params.whole_categories_threshold,
        generated_by=user.username,
    ).save(db)


@router.get(
    "",
    dependencies=[CanExtract],
    response_model=Page[ExtractionResponse],
)
def get_extractions(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    db: Session = Depends(get_db),
):
    return Extraction.get_page(db, page, page_size)


@router.delete(
    "/{id}",
    dependencies=[CanManageExtraction],
    response_model=ExtractionResponse,
)
def delete_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return Extraction.get(db, id).delete(db)


@router.get(
    "/{id}",
    dependencies=[CanExtract],
    response_model=ExtractionResponse,
)
def get_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return Extraction.get(db, id)


# TODO:
# @router.get(
#     "/{id}/categories",
#     dependencies=[CanExtract],
#     response_model=List[ExtractionCategoryNode],
# )
# def get_categories(id: int = Path(...), db: Session = Depends(get_db)):
#     return [
#         get_category_subtree(id, root_category, db)
#         for root_category in get_root_categories(db)
#     ]
