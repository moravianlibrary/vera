from schemas import AddDocumentResponse, EsSession
from services.elasticsearch import with_es_session
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from services.predictor import Predictor
from sqlalchemy.orm import Session
from models import with_db_session
from datatypes import AddDocumentResponseStatus
from .add_document import AddDocumentsProcessor
import logging
from typing import List
from config import VeraConfig


logger = logging.getLogger("uvicorn")


GET_UNPROCESSED_QUERY = {
    "size": 50,
    "from": 0,
    "query": {"bool": {"must": {"term": {"status": "Unprocessed"}}}},
}


def get_unprocessed_responses(
    es_session: EsSession,
) -> List[AddDocumentResponse]:
    return [
        AddDocumentResponse.model_validate(hit["_source"])
        for hit in AddDocumentResponse.search(
            es_session, GET_UNPROCESSED_QUERY
        )["hits"]["hits"]
    ]


@with_es_session
@with_db_session
def add_documents(
    db_session: Session,
    es_session: EsSession,
    predict_page_count: bool = True,
):
    add_documents_processor = AddDocumentsProcessor(
        session=db_session,
        es_session=es_session,
        registry_client=DigitizationRegistryClient(),
        predictor=Predictor.get_instance() if predict_page_count else None,
    )

    def process_response(response: AddDocumentResponse):
        try:
            document, status = add_documents_processor(
                response.attributes, response.added_by
            )

            response.document = document
            response.status = status
        except Exception as e:
            logger.error(f"Failed to add document due to error: {e}")
            response.status = AddDocumentResponseStatus.InternalError
        finally:
            response.indexed_at = VeraConfig.Timestamp.isoformat()
            response.save(es_session, True)

            if response.parent_id is not None:
                parent_response = AddDocumentResponse.model_validate(
                    AddDocumentResponse.get(es_session, response.parent_id)
                )
                issue = (
                    [i for i in response.document.issues if i.newly_added][0]
                    if response.document and response.document.issues
                    else None
                )
                parent_response.replace_issue(issue)
                parent_response.save(es_session, True)

    unprocessed = get_unprocessed_responses(es_session)

    while unprocessed:
        for response in unprocessed:
            process_response(response)
        unprocessed = get_unprocessed_responses(es_session)
