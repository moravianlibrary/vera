from schemas import AddDocumentResponse, EsSession
from services.elasticsearch import with_es_session
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from services.predictor import Predictor
from sqlalchemy.orm import Session
from models import with_db_session
from datatypes import AddDocumentResponseStatus
from .subtasks.add_document import AddDocumentsProcessor
import logging
from config import VeraConfig


logger = logging.getLogger("uvicorn")


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
            logger.error(
                f"Failed to add document due to error: {e}", exc_info=True
            )
            response.status = AddDocumentResponseStatus.InternalError
        finally:
            response.indexed_at = VeraConfig.Timestamp.isoformat()

            issues = (
                [i for i in response.document.issues if i.newly_added]
                if response.document and response.document.issues
                else None
            )

            if not issues:
                response.save(es_session, True)
                return

            issue = issues[0]
            response.document_id = issue.document_id
            response.replace_issue(issue)
            response.save(es_session, True)

            for prev_response in AddDocumentResponse.get_responses_with_sysno(
                es_session, response.document.sysno
            ):
                if prev_response.id == response.id:
                    continue
                if (
                    prev_response.status
                    != AddDocumentResponseStatus.MultipleIssues
                ):
                    issue.newly_added = False
                else:
                    # TODO: This else should not be here
                    # But without it, it sets newly_added to False
                    # for all previously added issues
                    issue.newly_added = True
                prev_response.replace_issue(issue)
                prev_response.save(es_session, True)

    unprocessed = AddDocumentResponse.get_unprocessed_responses(es_session)

    while unprocessed:
        for response in unprocessed:
            process_response(response)
        unprocessed = AddDocumentResponse.get_unprocessed_responses(es_session)
