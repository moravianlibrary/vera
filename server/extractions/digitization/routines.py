from sqlalchemy.orm import Session
from typing import List, Tuple

from documents.crud import get_documents_query_base
from documents.schemas import Document, DocumentsQuery
from services.exceptions import (
    CannotExtractDocumentWithoutCNB,
    CannotExtractDocumentWithoutPagesCount,
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
        pages_count = (
            document.pages_count
            or document.pages_count_manual
            or document.pages_count_predicted
        )
        if document.pages_count == 0:
            raise CannotExtractDocumentWithoutPagesCount

        document_ids.append(document.id)
        extracted_pages += pages_count

    return document_ids, extracted_pages
