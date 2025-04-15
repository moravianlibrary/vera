from sqlalchemy.orm import Session

from adapters.elasticsearch import with_es_session
from models import TaskItem
from schemas import EsSession, IndexCatalogRecord, IndexDocument

from .run_items_processing import run_items_processing_task
from .subtasks import update_catalog_record


@with_es_session
def SyncCatalogRecordsWithCatalogs(
    es_session: EsSession, session: Session, task_id: int
):
    def reindex_catalog_record(task_item: TaskItem):
        catalog_record = task_item.catalog_record

        update_catalog_record(session, es_session, catalog_record)
        IndexCatalogRecord.model_validate(catalog_record).save(es_session)
        for document in catalog_record.documents:
            IndexDocument.model_validate(document).save(es_session)

    run_items_processing_task(session, task_id, reindex_catalog_record)
