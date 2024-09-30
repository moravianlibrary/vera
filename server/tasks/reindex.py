from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from schemas import IndexCatalogRecord, IndexDocument, EsSession
from services.elasticsearch import with_es_session


@with_es_session
def Reindex(es_session: EsSession, session: Session, task_id: int):
    reindexed_sysno = set()

    def reindex_document(document: Document):
        IndexDocument.model_validate(document).save(es_session)
        if document.sysno not in reindexed_sysno:
            IndexCatalogRecord.model_validate(document.catalog_record).save(
                es_session
            )
            reindexed_sysno.add(document.sysno)

    run_task(session, task_id, reindex_document)
