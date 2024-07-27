from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from services.documents_indexer import DocumentsIndexer


def Reindex(session: Session, task_id: int):
    indexer = DocumentsIndexer.get_instance()

    def reindex_document(document: Document):
        indexer.index(document)

    run_task(session, task_id, reindex_document)
