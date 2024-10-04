from sqlalchemy.orm import Session
from models import TaskItem
from .run_items_processing import run_items_processing_task
from schemas import IndexCatalogRecord, IndexDocument, EsSession
from services.elasticsearch import with_es_session


@with_es_session
def ReindexCatalogRecords(
    es_session: EsSession, session: Session, task_id: int
):
    def reindex_catalog_record(task_item: TaskItem):
        catalog_record = task_item.catalog_record

        IndexCatalogRecord.model_validate(catalog_record).save(es_session)

        for document in catalog_record.documents:
            IndexDocument.model_validate(document).save(es_session)

    run_items_processing_task(session, task_id, reindex_catalog_record)
