from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from schemas import IndexDocument


def Reindex(session: Session, task_id: int):
    indexer = IndexDocument.get_indexer_instance()

    def reindex_document(document: Document):
        indexer.index(document)

    run_task(session, task_id, reindex_document)
