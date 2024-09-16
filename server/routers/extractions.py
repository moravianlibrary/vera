from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from schemas import CurrentUser, Page, ExtractionResponse, GenerateExtraction
from models import Intention, Extraction
from services.extractions_generator.generator import ExtractionGenerator
from .utils.permissions import CanExtract, CanManageExtraction
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession


router = APIRouter(
    prefix="/extractions/generated", tags=["Generated extractions"]
)


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=ExtractionResponse,
)
def create_extraction(
    settings: GenerateExtraction,
    user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    generator = ExtractionGenerator(
        Intention.get_current_intention(db).id, settings, db
    )
    generator.generate()

    return Extraction(
        document_ids=generator.extracted_documents,
        selected_pages=generator.extracted_pages_count,
        target_pages=settings.target_pages,
        include_categories=settings.include_categories,
        location_ids=settings.location_ids,
        target_pages_threshold=settings.target_pages_threshold,
        whole_categories_threshold=settings.whole_categories_threshold,
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
    db: Session = DependsOnDbSession,
):
    return Extraction.get_page(db, page, page_size)


@router.delete(
    "/{id}",
    dependencies=[CanManageExtraction],
    response_model=ExtractionResponse,
)
def delete_extraction(id: int = Path(...), db: Session = DependsOnDbSession):
    return Extraction.get(db, id).delete(db)


@router.get(
    "/{id}",
    dependencies=[CanExtract],
    response_model=ExtractionResponse,
)
def get_extraction(id: int = Path(...), db: Session = DependsOnDbSession):
    return Extraction.get(db, id)
