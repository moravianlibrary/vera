from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

# from typing import List

from schemas.security import CurrentUser
from routers.security import get_current_user

# TODO: fix categories
# from categories.crud import get_root_categories
# from categories.quotas.crud import get_quota
from categories.intentions.models import Intention
from extractions.generated import crud, schemas
from extractions.generated.generator import ExtractionGenerator

# from extractions.routines import get_category_subtree
# from extractions.schemas import ExtractionCategoryNode
from services.database import get_db

# from services.exceptions import EmptyExtraction
from extractions.permissions import CanExtract, CanManageExtraction


router = APIRouter(prefix="/extractions/generated")


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=schemas.GeneratedExtraction,
)
def create_extraction(
    params: schemas.GenerateExtraction,
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

    extraction = crud.create_extraction(
        generator.extracted_documents,
        generator.extracted_pages_count,
        pages_count,
        params,
        user.username,
        db,
    )

    return extraction


@router.get(
    "",
    dependencies=[CanExtract],
    response_model=schemas.GeneratedExtractions,
)
def get_extractions(
    offset: int = Query(0, description="Pagination offset"),
    limit: int = Query(50, description="Pagination page size"),
    db: Session = Depends(get_db),
):
    return schemas.GeneratedExtractions(
        extractions=crud.get_extractions(db, offset, limit),
        num_found=crud.get_extractions_num_found(db),
    )


@router.delete(
    "/{id}",
    dependencies=[CanManageExtraction],
    response_model=schemas.GeneratedExtraction,
)
def delete_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_extraction(id, db)


@router.get(
    "/{id}",
    dependencies=[CanExtract],
    response_model=schemas.GeneratedExtraction,
)
def get_extraction(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.get_extraction(id, db)


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
