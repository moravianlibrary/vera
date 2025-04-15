from typing import List, Optional

from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session

from custom_types import GeneralPermission
from datatypes import DigitizationState, EsRoutingParams
from exceptions import EmptyExtractionException
from models import DigitizationList, Document
from schemas import DigitizationList as DigitizationListSchema
from schemas import EsSession, IndexDocument, Page

from ._resources import DependsOnDbSession, DependsOnEsSession
from .security import DependsOnCallerUsername, WithPermission

router = APIRouter(prefix="/digitization-lists", tags=["Digitization lists"])

# TODO: make documents index in dedicated process


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadDigitizationLists)],
    response_model=DigitizationListSchema,
)
def search(
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    pass


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateDigitizationLists)],
    response_model=DigitizationListSchema,
)
def create(
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


@router.put(
    "/{digitization_list_id}/add-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationListSchema,
)
def add_documents(
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
    "/{digitization_list_id}/remove-documents",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationListSchema,
)
def remove_documents(
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


@router.post(
    "/{digitization_list_id}/archive",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationListSchema,
)
def archive(
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    pass


@router.delete(
    "/{digitization_list_id}",
    dependencies=[WithPermission(GeneralPermission.ManageDigitizationLists)],
    response_model=DigitizationListSchema,
)
def delete(
    digitization_list_id: int = Path(...),
    session: Session = DependsOnDbSession,
    es_session: EsSession = DependsOnEsSession,
):
    digitization_list = DigitizationList.get(session, digitization_list_id)

    for document in digitization_list.documents:
        IndexDocument.model_validate(document).save(es_session)

    return digitization_list.delete(session)
