from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from models import DigitizationList, Document
from schemas import DigitizationList as DigitizationListSchema, Page
from .utils.permissions import CanExtract, CanManageDigitizationList
from .utils.dependencies import (
    DependsOnDbSession,
    DependsOnCallerUsername,
    DependsOnEsSession,
)
from exceptions import EmptyExtractionException
from schemas import IndexDocument, EsSession
from datatypes import EsRoutingParams, DigitizationState
from .utils.query_routing_parser import parse_query_routing

router = APIRouter(
    prefix="/extractions/digitization", tags=["Digitization lists"]
)

# TODO: make documents index in dedicated process


@router.post(
    "",
    dependencies=[CanExtract],
    response_model=DigitizationListSchema,
)
def create_extraction(
    query_routing_params: EsRoutingParams,
    intention_id: Optional[int] = Query(None, description="Intention ID"),
    ignore_digitization_states: List[DigitizationState] = Query([]),
    created_by: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    document_ids = IndexDocument.search_source_ids(
        es_session, parse_query_routing(query_routing_params)
    )
    if not document_ids:
        raise EmptyExtractionException()

    digitization_list = (
        DigitizationList(intention_id=intention_id, created_by=created_by)
        .save(session)
        .add_documents(session, document_ids, ignore_digitization_states)
    )

    for document_id in document_ids:
        IndexDocument.model_validate(Document.get(session, document_id)).save(
            es_session
        )

    return digitization_list


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
    query_routing_params: EsRoutingParams,
    digitization_list_id: int = Path(...),
    ignore_digitization_states: List[DigitizationState] = Query([]),
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    document_ids = IndexDocument.search_source_ids(
        es_session, parse_query_routing(query_routing_params)
    )

    digitization_list = DigitizationList.get(session, digitization_list_id)
    digitization_list.add_documents(
        session, document_ids, set(ignore_digitization_states)
    )

    for document_id in document_ids:
        IndexDocument.model_validate(Document.get(session, document_id)).save(
            es_session
        )

    return digitization_list


@router.put(
    "/{digitization_list_id}/remove_documents",
    dependencies=[CanManageDigitizationList],
    response_model=DigitizationListSchema,
)
def remove_documents_from_extraction(
    query_routing_params: EsRoutingParams,
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    document_ids = IndexDocument.search_source_ids(
        es_session, parse_query_routing(query_routing_params)
    )

    digitization_list = DigitizationList.get(session, digitization_list_id)
    digitization_list.remove_documents(session, document_ids)

    for document_id in document_ids:
        IndexDocument.model_validate(Document.get(session, document_id)).save(
            es_session
        )

    return digitization_list


@router.delete(
    "/{digitization_list_id}",
    dependencies=[CanManageDigitizationList],
    response_model=DigitizationListSchema,
)
def delete_extraction(
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    digitization_list = DigitizationList.get(session, digitization_list_id)

    for document in digitization_list.documents:
        IndexDocument.model_validate(document).save(es_session)

    return digitization_list.delete(session)
