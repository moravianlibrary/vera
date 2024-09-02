from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional
from models import DigitizationList
from schemas import DigitizationList as DigitizationListSchema, Page
from .utils.permissions import CanExtract, CanManageDigitizationList
from .utils.dependencies import (
    DependsOnDbSession,
    DependsOnCallerUsername,
    DependsOnDocumentsIndexer,
)
from exceptions import EmptyExtractionException
from services.documents_indexer import DocumentsIndexer
from datatypes import ElasticsearchParams

router = APIRouter(prefix="/extractions/digitization")


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=DigitizationListSchema,
)
def create_extraction(
    query_params: ElasticsearchParams,
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    created_by: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
):
    document_ids = indexer.get_document_ids(query_params)
    if not document_ids:
        raise EmptyExtractionException()
    return (
        DigitizationList(intention_id=intention_id, created_by=created_by)
        .save(session)
        .add_documents(session, document_ids)
    )


@router.get(
    "",
    dependencies=[CanExtract],
    response_model=Page[DigitizationListSchema],
)
def get_extractions(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return DigitizationList.get_page(session, page, page_size)


@router.get(
    "/{digitization_list_id}",
    dependencies=[CanExtract],
    response_model=DigitizationListSchema,
)
def get_extraction(
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
):
    return DigitizationList.get(session, digitization_list_id)


@router.put(
    "/{digitization_list_id}/add_documents",
    dependencies=[CanManageDigitizationList],
    response_model=DigitizationListSchema,
)
def add_documents_to_extraction(
    query_params: ElasticsearchParams,
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
):
    document_ids = indexer.get_document_ids(query_params)

    digitization_list = DigitizationList.get(session, digitization_list_id)
    digitization_list.add_documents(session, document_ids)

    return digitization_list


@router.put(
    "/{digitization_list_id}/remove_documents",
    dependencies=[CanManageDigitizationList],
    response_model=DigitizationListSchema,
)
def remove_documents_from_extraction(
    query_params: ElasticsearchParams,
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
):
    document_ids = indexer.get_document_ids(query_params)

    digitization_list = DigitizationList.get(session, digitization_list_id)
    digitization_list.remove_documents(session, document_ids)

    return digitization_list


@router.delete(
    "/{digitization_list_id}",
    dependencies=[CanManageDigitizationList],
    response_model=DigitizationListSchema,
)
def delete_extraction(
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
):
    return DigitizationList.get(session, digitization_list_id).delete(session)
