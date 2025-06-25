from sqlalchemy.orm import Session

from adapters.indexer import with_es_session
from models import TaskItem
from schemas import EsSession, IndexCatalogRecord, IndexDocument

from .run_items_processing import run_items_processing_task


@with_es_session
def ReindexDocuments(es_session: EsSession, session: Session, task_id: int):
    reindexed_sysno = set()

    def reindex_document(task_item: TaskItem):
        if task_item.document is None:
            IndexDocument.delete(es_session, task_item.item_id)
            return

        document = task_item.document

        IndexDocument.model_validate(document).save(es_session)

        if document.sysno not in reindexed_sysno:
            IndexCatalogRecord.model_validate(document.catalog_record).save(
                es_session
            )
            reindexed_sysno.add(document.sysno)

    run_items_processing_task(session, task_id, reindex_document)
