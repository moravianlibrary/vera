from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Tuple

from schemas.documents import Document
from schemas.documents_query import DocumentsQuery
from models.documents import Document as DocumentModel
from services.exceptions import (
    CannotExtractDocumentWithoutCNB,
    CannotExtractDocumentWithoutPagesCount,
    DocumentAlreadyExtractedException,
    DocumentsNotInExtractionException,
    EmptyExtraction,
)


def get_extraction_from_query(
    query: DocumentsQuery, db: Session
) -> Tuple[List[int], int]:
    documents: List[Document] = get_documents_query_base(db, query).all()

    if len(documents) == 0:
        raise EmptyExtraction

    document_ids = []
    extracted_pages = 0

    for document in documents:
        if document.cnb is None:
            raise CannotExtractDocumentWithoutCNB
        if document.extraction_id is not None:
            raise DocumentAlreadyExtractedException
        pages_count = (
            document.pages_count
            or document.pages_count_manual
            or document.pages_count_predicted
            or 0
        )
        if pages_count <= 0:
            raise CannotExtractDocumentWithoutPagesCount

        document_ids.append(document.id)
        extracted_pages += pages_count

    return document_ids, extracted_pages


def get_extraction_documents_from_query(
    extraction_id: int, query: DocumentsQuery, db: Session
) -> Tuple[List[int], int]:
    count_not_in_extraction = (
        get_documents_query_base(db, query)
        .filter(DocumentModel.extraction_id != extraction_id)
        .count()
    )
    if count_not_in_extraction > 0:
        raise DocumentsNotInExtractionException

    count_in_extraction = (
        get_documents_query_base(db, query)
        .filter(DocumentModel.extraction_id == extraction_id)
        .count()
    )
    if count_in_extraction == 0:
        raise DocumentsNotInExtractionException

    pages_count = (
        get_documents_query_base(db, query)
        .with_entities(
            func.sum(
                func.coalesce(
                    DocumentModel.pages_count,
                    DocumentModel.pages_count_manual,
                    DocumentModel.pages_count_predicted,
                    0,
                )
            )
        )
        .scalar()
    )
    documents: List[Document] = get_documents_query_base(db, query).all()

    return [document.id for document in documents], pages_count
