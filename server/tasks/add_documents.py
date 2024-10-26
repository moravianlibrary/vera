from schemas import (
    IdentifierWithAttributes,
    Identifier,
    AddDocumentResponse,
    EsSession,
)
from services.elasticsearch import with_es_session
from services.external.digitization_registry import (
    DigitizationRegistryClient,
)
from services.predictor import Predictor
from sqlalchemy.orm import Session
from models import with_db_session
from .add_document import AddDocumentsProcessor
from typing import List
import logging


logger = logging.getLogger("uvicorn")


@with_es_session
@with_db_session
def add_documents(
    db_session: Session,
    es_session: EsSession,
    attributes_list: List[IdentifierWithAttributes],
    added_by: str,
    predict_page_count: bool = True,
):
    add_documents_processor = AddDocumentsProcessor(
        session=db_session,
        es_session=es_session,
        registry_client=DigitizationRegistryClient(),
        predictor=Predictor.get_instance() if predict_page_count else None,
        added_by=added_by,
    )

    for attributes in attributes_list:
        try:
            document, status = add_documents_processor(attributes)

            AddDocumentResponse(
                identifier=Identifier(
                    identifier_type=attributes.identifier_type,
                    value=attributes.value,
                ),
                status=status,
                document=document,
                added_by=added_by,
            ).save(es_session)
        except Exception as e:
            logger.error(f"Failed to add document due to error: {e}")
